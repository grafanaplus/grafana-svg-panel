import {MetricsPanelCtrl} from 'app/plugins/sdk';
import _ from 'lodash';
import kbn from 'app/core/utils/kbn';
import TimeSeries from 'app/core/time_series';
import rendering from './rendering';
import {SVGDemos} from './demos';
import {Snap} from 'https://cdnjs.cloudflare.com/ajax/libs/snap.svg/0.4.1/snap.svg-min.js';

export class SVGCtrl extends MetricsPanelCtrl {

  constructor($scope, $injector, $rootScope) {
    super($scope, $injector);
    this.$rootScope = $rootScope;

    var panelDefaults = {
      links: [],
      datasource: null,
      maxDataPoints: 3,
      interval: null,
      targets: [{}],
      cacheTimeout: null,
      nullPointMode: 'connected',
      aliasColors: {},
      format: 'short',
      valueName: 'current',
      
      svg_data: '<svg xmlns="http://www.w3.org/2000/svg" width="100%" height="100%" viewBox="0 0 1000 1000" ></svg>',
      js_code: '//paste body of handleMetric function here\n\n//Parameters:\n//ctrl - instance of current svg-panel\n//elem - SVG panel html element',
      js_init_code: '//this code is executed right after the first initialization of the SVG'
    };

    _.defaults(this.panel, panelDefaults);

    this.events.on('render', this.onRender.bind(this));
    this.events.on('data-received', this.onDataReceived.bind(this));
    this.events.on('data-error', this.onDataError.bind(this));
    this.events.on('data-snapshot-load', this.onDataReceived.bind(this));
    this.events.on('init-edit-mode', this.onInitEditMode.bind(this));
    
    this.demos = new SVGDemos(this);
    this.initialized = 0;
  }

  onInitEditMode() {
    this.addEditorTab('Options', 'public/plugins/grafana-svg-panel/editor.html', 2);
    this.unitFormats = kbn.getUnitFormats();
  }

  setUnitFormat(subItem) {
    this.panel.format = subItem.value;
    this.render();
  }

  onDataError() {
    this.series = [];
    this.render();
  }

  changeSeriesColor(series, color) {
    series.color = color;
    this.panel.aliasColors[series.alias] = series.color;
    this.render();
  }
  
  setHandleMetricFunction() {
    this.panel.handleMetric = Function ('ctrl', 'elem', this.panel.js_code);
  }
  
  setInitFunction() {
	this.initialized = 0;
    this.panel.doInit = Function ('ctrl', 'elem', this.panel.js_init_code);
  }

  onRender() {    
    if (!this.panel.handleMetric) {
      this.setHandleMetricFunction();
    }
    
    if (!this.panel.doInit) {
      this.setInitFunction();
    }
    
    this.data = this.parseSeries(this.series);
  }

  parseSeries(series) {
    return _.map(this.series, (serie, i) => {
      return {
        label: serie.alias,
        data: serie.stats[this.panel.valueName],
        color: this.panel.aliasColors[serie.alias] || this.$rootScope.colors[i]
      };
    });
  }

  onDataReceived(dataList) {
    this.series = dataList.map(this.seriesHandler.bind(this));
    this.data = this.parseSeries(this.series);
    this.render(this.data);
  }

  resetSVG() {
	this.initialized = 0;
  }  

  seriesHandler(seriesData) {
    var series = new TimeSeries({
      datapoints: seriesData.datapoints,
      alias: seriesData.target
    });

    series.flotpairs = series.getFlotPairs(this.panel.nullPointMode);
    return series;
  }

  getDecimalsForValue(value) {
    if (_.isNumber(this.panel.decimals)) {
      return { decimals: this.panel.decimals, scaledDecimals: null };
    }

    var delta = value / 2;
    var dec = -Math.floor(Math.log(delta) / Math.LN10);

    var magn = Math.pow(10, -dec);
    var norm = delta / magn; // norm is between 1.0 and 10.0
    var size;

    if (norm < 1.5) {
      size = 1;
    } else if (norm < 3) {
      size = 2;
      // special case for 2.5, requires an extra decimal
      if (norm > 2.25) {
        size = 2.5;
        ++dec;
      }
    } else if (norm < 7.5) {
      size = 5;
    } else {
      size = 10;
    }

    size *= magn;

    // reduce starting decimals if not needed
    if (Math.floor(value) === value) { dec = 0; }

    var result = {};
    result.decimals = Math.max(0, dec);
    result.scaledDecimals = result.decimals - Math.floor(Math.log(size) / Math.LN10) + 2;

    return result;
  }

  formatValue(value) {
    var decimalInfo = this.getDecimalsForValue(value);
    var formatFunc = kbn.valueFormats[this.panel.format];
    if (formatFunc) {
      return formatFunc(value, decimalInfo.decimals, decimalInfo.scaledDecimals);
    }
    return value;
  }

  link(scope, elem, attrs, ctrl) {
    rendering(scope, elem, attrs, ctrl);
  }
  
}

SVGCtrl.templateUrl = 'module.html';