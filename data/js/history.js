'use strict';

var HistoryRouter = Backbone.Router.extend({
  // routes: {
  //   "query/:type/:id"     :   "query",
  //   "list/:id"            :   "list"
  // }
});

var HistoryItem = Backbone.Model.extend({
  initialize : function initialize(model, options) {
    this.set("time", moment(model.time));
  },
  _getNotNull : function (list) {
    return this.get(_.find(list, function (key) { return (this.get(key) != null && this.get(key).length > 0); }, this));
  },
  // some standard and convenience methods for info
  title : function () {
    return this._getNotNull(["twitter:title", "og:title", "title"]);
  },
  favicon : function () {
    return this.get('icon');
  },
  description : function () {
    return this._getNotNull(["twitter:description", "og:description"]);
  },
  hasImage : function () {
    return (this.image() != null);
  },
  isBookmarked : function () {
    return !!this.get('bookmarked');
  },
  image : function () {
    return this._getNotNull(["twitter:image", "twitter:image:src", "og:image"]);
  },
  isSecure : function () {
    return (this.get("scheme") === "https");
  }
});

var HistoryItemView = Backbone.View.extend({
  events : {
    "click" : "onClickHistoryItemView"
  },
  className : "history",
  tagName : "li",
  template : _.template($('#history-item-template').html()),
  initialize: function initialize() {
    this.model.on('change', this.render, this);
  },
  render : function render() {
    this.$el.html(this.template(this.model));
    return this;
  },
  onClickHistoryItemView : function () {
    addon.emit("history:events:click", this.model.get("url"));
  }
});

function normalize(obj) {
  var value = "";
  var keys = _.rest(arguments);
  _.each(keys, function (k) {
    if (_.has(obj, k) && obj[k] !== null) {
      value = obj[k];
    }
  });
  return value;
}

var HistoryList = Backbone.Collection.extend({
  model : HistoryItem,
  initialize : function initialize() {
    addon.on("icon:set", icon => {
      if (!icon) { return; }
      var model = this.findWhere({ url : icon.url });
      if (model) {
        model.set("icon", icon.icon_url);
      }
    });

    addon.on("url:meta", metas => {
      if (!metas) { return; }
      var model = this.findWhere({ url : metas.url });
      if (model) {
        model.set(metas);
      }
    });

    addon.on("url:bookmark", ({ url }) => {
      var model = this.findWhere({ url : url });
      model.set("bookmarked", true);
    })
  },
  render : function render() {
    this.$el.html(this.template(this.model));
    return this;
  }
});

var HistoryListView = Backbone.View.extend({
  tagName : "ul",
  className : "history-list",
  initialize: function initialize() {
    this.collection.on('reset', this.render, this);
    this.collection.on('add', this.render, this);
  },
  render: function () {
    this.$el.empty();
    this.collection.each(function (historyItem) {
      var view = new HistoryItemView({model: historyItem, id : historyItem.id});
      this.$el.append(view.render().$el);
    }.bind(this));
  return this;
  }
});

var SearchInputView = Backbone.View.extend({
  events : {
    "keyup" : "onKeyUp"
  },
  onKeyUp : function () {
    addon.emit("history:events:query", this.$el.val());
    // possibly debounce every second to set the query
    // this.router.navigate("#query/query");
  }
});

var Application = Backbone.View.extend({
  events : {

  },
  initialize: function initialize() {
    var hl = this.historyList = new HistoryList();
    this.historyListView = new HistoryListView({ collection : this.historyList, el : $("#history-list-view") });
    this.searchInputView = new SearchInputView({ el : $("#query") });

    addon.on("history:date", function (date) {
      $("#date").text(moment(date).format('LL'));
    });
    addon.emit("history:date");
    addon.on("history:reset", function(items) {
      if (items && Array.isArray(items)) {
        hl.reset(items.map(function(i) { return new HistoryItem(i); }));
      }
    });

    // this will help get single history additions
    addon.on("history:add", function(item) {
      if (item) {
        console.log("ITEM", item);
        hl.add(new HistoryItem(item));
      } else {
        console.log("NOT ITEM", item);
      }
    });

    this.router = new HistoryRouter();
    Backbone.history.start({pushState: false});

  }
});

var HistoryApp = new Application({el : $("#history-items")});

window.addEventListener('load', function onLoad() {
  window.addEventListener('load', onLoad, false);
  addon.emit("history:events:query", "");
}, false);