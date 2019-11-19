var _ = require('underscore');
// var cdb = require('internal-carto.js');
var Backbone = require('backbone');
var CoreView = require('backbone/core-view');
var ViewFactory = require('builder/components/view-factory');
var TipsyTooltipView = require('builder/components/tipsy-tooltip-view');
var checkAndBuildOpts = require('builder/helpers/required-opts');
var IMPORT_OPTIONS = require('./import-options');
var ImportButtonView = require('./import-button-view');
var CategoryTitleTemplate = require('./import-catagory-title.tpl');

var REQUIRED_OPTS = [
  'createModel',
  'userModel',
  'configModel',
  'privacyModel',
  'guessingModel'
];

const IMPORTER_TYPES = {
  cloud: 'cloud',
  database: 'database',
  other: 'other'
};

/**
 *  Imports view
 *
 *  Displays all the import options available
 *  through new create dialog.
 *
 *  IMPORTANT!!
 *
 *  If you need to add a new import pane:
 *
 *  - Create the proper class within imports folder and its tests.
 *  - Add necessary info in import_options file.
 *  - Create a check function here if needed, if not will appear
 *    always enabled (for everybody!).
 *
 */

module.exports = CoreView.extend({
  className: 'ImportOptions',

  events: {
    'click .js-goNext': '_moveToNextTabs',
    'click .js-goPrev': '_moveToPrevTabs'
  },

  initialize: function (opts) {
    checkAndBuildOpts(opts, REQUIRED_OPTS, this);

    this._initModels();
  },

  render: function () {
    this._destroyBinds();
    this.clearSubViews();
    this.$el.empty();

    this._generateContent();
    this._initBinds();

    return this;
  },

  _initModels: function () {
    this.model = new Backbone.Model({
      page: 1,
      maxPages: 0
    });
  },

  _generateContent: function () {
    this.$el.append(CategoryTitleTemplate({
      title: 'Cloud Storage'
    }));
    this._generateImportButtons(this._filterImportsByType(IMPORTER_TYPES.cloud));

    this.$el.append(CategoryTitleTemplate({
      title: 'Database'
    }));
    this._generateImportButtons(this._filterImportsByType(IMPORTER_TYPES.database));

    this.$el.append(CategoryTitleTemplate({
      title: 'Other'
    }));
    this._generateImportButtons(this._filterImportsByType(IMPORTER_TYPES.other));
  },

  _filterImportsByType: function (type) {
    return Object.keys(IMPORT_OPTIONS).reduce(function (sum, key) {
      if (IMPORT_OPTIONS[key].type === type) {
        sum[key] = IMPORT_OPTIONS[key];
      }
      return sum;
    }, {});
  },

  _generateImportButtons: function (importOptions) {
    _.each(importOptions, function (importConfig) {
      var connector = {};
      if (!_.isEmpty(importConfig) && importConfig.enabled(this._configModel, this._userModel)) {
        connector = {
          name: importConfig.name,
          selected: importConfig.name === 'file'
        };

        var importButton;
        importButton = new ImportButtonView(
          _.extend(
            importConfig.options || {},
            {
              importView: importConfig.view,
              name: importConfig.name,
              title: importConfig.title,
              enable: importConfig.enable,
              fallback: importConfig.fallback,
              userModel: this._userModel,
              configModel: this._configModel,
              createModel: this._createModel,
              privacyModel: this._privacyModel,
              guessingModel: this._guessingModel
            }
          )
        );

        importButton.bind('importSelected', this._importSelected, this);

        connector.createButtonView = function () {
          return importButton;
        };

        this.$el.append(connector.createButtonView().render().el);
      }
    }, this);
  },

  _checkGoogleDriveImport: function () {
    if (!this._configModel.get('oauth_gdrive')) {
      this._setFailedTab('gdrive', 'key');
      return false;
    }
    return true;
  },

  _checkDropboxImport: function () {
    if (!this._configModel.get('oauth_dropbox')) {
      this._setFailedTab('dropbox', 'key');
      return false;
    }
    return true;
  },

  _checkBoxImport: function () {
    if (!this._configModel.get('oauth_box')) {
      this._setFailedTab('box', 'key');
      return false;
    }
    return true;
  },

  _checkTwitterImport: function () {
    if (!this._configModel.get('datasource_search_twitter')) {
      this._setFailedTab('twitter', 'key');
      return false;
    }

    if (!this._userModel.get('twitter').enabled) {
      return false;
    }

    if (!this._userModel.canCreateTwitterDataset()) {
      this._setFailedTab('twitter', 'credits');
      return false;
    }
    return true;
  },

  _checkInstagramImport: function () {
    if (!this._userModel.featureEnabled('instagram_import')) {
      return false;
    }
    if (!this._configModel.get('oauth_instagram')) {
      this._setFailedTab('instagram', 'key');
      return false;
    }
    return true;
  },

  _checkSalesforceImport: function () {
    // Connector is now disabled for everyone.
    // You might be able to use the following check to determine
    // if user/org has this connector enabled:
    // this._userModel.get('salesforce').enabled
    return false;
  },

  _checkMailchimpImport: function () {
    if (!this._configModel.get('oauth_mailchimp')) {
      this._setFailedTab('mailchimp', 'key');
      return false;
    }

    if (!this._userModel.featureEnabled('mailchimp_import')) {
      return false;
    }
    return true;
  },

  _checkPostgreSQLImport: function () {
    return false;
  },

  _checkMySQLImport: function () {
    return false;
  },

  _checkSQLServerImport: function () {
    return false;
  },

  _checkHiveImport: function () {
    return false;
  },

  _setFailedTab: function (tabName, type) {
    var $tab = this.$('.js-' + tabName + 'Tab');
    $tab.addClass('disabled');

    var tooltip = new TipsyTooltipView({
      el: $tab,
      title: function () {
        return _t('components.modals.add-layer.imports.tab-options-error.' + type, { name: tabName });
      }
    });
    this.addView(tooltip);
  },

  _setUploadModel: function (d) {
    var uploadModel = this._createModel.getUploadModel();
    uploadModel.setFresh(d);
  },

  _initBinds: function () {
  //  this.model.bind('change:page', this._moveNavigationTabs, this);
  },

  _destroyBinds: function () {
    // if (this._tabPaneCollection) {
    //   this._tabPaneCollection.bind('change:selected', null, this);
    // }
  },

  // //////////
  // Events //
  // //////////

  _importSelected: function (selectedImport) {
    var opts = selectedImport.options;

    var importContent;

    // Check if import option function exists
    var fn = this['_check' + opts.title.replace(' ', '') + 'Import'];
    var isEnabled = true;

    if (fn) {
      isEnabled = fn.bind(this)();
    }

    if ((isEnabled || isEnabled === undefined) /* && !_.isEmpty(opts.fallback) */) {
      var ImportView = opts.importView;
      importContent = new ImportView(
        _.extend(
          selectedImport.options,
          {
            userModel: this._userModel,
            configModel: this._configModel,
            title: opts.title,
            createModel: this._createModel,
            privacyModel: this._privacyModel,
            guessingModel: this._guessingModel
          }
        )
      );
    } else if (opts.fallback) {
      importContent = ViewFactory.createByTemplate(opts.fallback);
    }

    if (importContent) {
      // TODO importContent.bind('change', this._setUploadModel, this);
      this.$el.empty();
      this.$el.append(importContent.render().el);
      this.addView(importContent);
    }
  },

  clean: function () {
    this._destroyBinds();
    CoreView.prototype.clean.call(this);
  }

});
