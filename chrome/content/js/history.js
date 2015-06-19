/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */
'use strict';

/* global _, $, addon, Backbone, moment, */
var HistoryRouter = Backbone.Router.extend({
  // routes: {
  //   'query/:type/:id'     :   'query',
  //   'list/:id'            :   'list'
  // }
});

var HistoryItem = Backbone.Model.extend({
  initialize : function initialize(model, options) {
    this.set('time', moment(model.time));
    if (this.get('twitter:creator') === this.get('twitter:site')) {
      this.unset('twitter:creator');
    }
    ['twitter:creator', 'twitter:site'].forEach(function(t) {
      if (this.has(t) && !/^[@A-Za-z0-9_]{1,15}$/.test(this.get(t))) {
        this.unset(t);
      }
    }, this);
  },
  _getNotNull : function(list) {
    return this.get(list.find(key => {
      let value = this.get(key);
      return (value != null && value.length > 0);
    }));
  },
  // some standard and convenience methods for info
  title : function() {
    return this._getNotNull(['twitter:title', 'og:title', 'title']);
  },
  favicon : function() {
    return this.get('icon');
  },
  description : function() {
    return this._getNotNull(['twitter:description', 'og:description']);
  },
  hasImage : function() {
    return (this.image() != null);
  },
  isBookmarked : function() {
    return !!this.get('bookmarked');
  },
  image : function() {
    return this._getNotNull(['image_src', 'icon:fluid-icon', 'twitter:image', 'twitter:image:src', 'og:image']);
  },
  isSecure : function() {
    return (this.get('scheme') === 'https');
  },
  twitterURL : function(handle) {
    if (handle) {
      return 'https://twitter.com/' + handle.replace(/^@/, '');
    }
  }
});

var HistoryItemView = Backbone.View.extend({
  events : {
    'click .action-expand' : 'onClickHistoryExpand',
    'click .action-ellipsis' : 'onClickEllipsisExpand',
    'click #action-delete' : 'onDelete',
    'click #action-delete-related' : 'onDeleteRelated'
  },
  className : 'history',
  tagName : 'li',
  template : _.template($('#history-item-template').html()),
  initialize: function initialize() {
    this.model.on('change', _ => this.render());
    this.model.on('destroy', _ => this.remove());
  },
  render : function render() {
    this.$el.html(this.template(this.model));
    this.$el.find('img.image').error(({ target }) => {
      target.classList.add('hide');
    }).attr('src', this.model.image());
    return this;
  },
  onClickEllipsisExpand : function() {
    this.$el.find('button.action-expand').button('toggle');
    return this.onClickHistoryExpand();
  },
  onClickHistoryExpand : function() {
    // toggle larger image
    this.$el.find('.image').toggleClass('max-height-image');
    // toggle the description area
    this.$el.find('.block-description').toggleClass('hidden');
    // toggle the actions
    this.$el.find('ol.meta').toggleClass('invisible');
    // toggle the ... which indicates there is a description
    this.$el.find('.action-ellipsis').toggleClass('hidden');

    // we need to return true so the event can bubble up to the toggle button
    return true;
  },
  onDelete: function() {
    addon.emit('history:events:delete', this.model.get('url'));
    return false;
  },
  onDeleteRelated: function() {
    addon.emit('history:events:delete-related', this.model.get('url'));
    return false;
  }
});

var HistoryList = Backbone.Collection.extend({
  model : HistoryItem,
  initialize : function initialize() {
    addon.on('url:icon', icon => {
      if (!icon) { return; }
      var model = this.findWhere({url : icon.url});
      if (model) {
        model.set('icon', icon.iconUrl);
      }
    });

    addon.on('url:meta', metas => {
      if (!metas) { return; }
      var model = this.findWhere({url : metas.url});
      if (model) {
        model.set(metas);
      }
    });

    addon.on('url:bookmark', ({ url }) => {
      var model = this.findWhere({url : url});
      if (model) {
        model.set('bookmarked', true);
      }
    });

    addon.on('bookmark:removed', ({ url }) => {
      var model = this.findWhere({url : url});
      if (model) {
        model.set('bookmarked', false);
      }
    });

    addon.on('history:removed', ({ url }) => {
      var model = this.findWhere({url : url});

      if (model) {
        model.destroy();
      }
    });
  },
  render : function render() {
    this.$el.html(this.template(this.model));
    return this;
  }
});

var HistoryListView = Backbone.View.extend({
  tagName : 'ul',
  className : 'history-list',
  initialize: function initialize() {
    this.collection.on('reset', this.render, this);
    this.collection.on('add', this.render, this);
  },
  render: function() {
    this.$el.empty();
    this.collection.each(item => {
      var view = new HistoryItemView({model: item, id : item.id});
      this.$el.append(view.render().$el);
    });
    return this;
  }
});

function sendQuery({ date, query }) {
  addon.emit('history:events:query', {
    from: moment(date).startOf('day').format('X') * 1000,
    to: moment(date).endOf('day').format('X') * 1000,
    query: query.trim()
  });
}

function isSameDay (day1, day2) {
  return day1.isSame(day2, 'day') &&
         day1.isSame(day2, 'month') &&
         day1.isSame(day2, 'year');
}

var Application = Backbone.View.extend({
  initialize: function initialize() {
    var hl = this.historyList = new HistoryList();
    this.historyListView = new HistoryListView({
      collection : this.historyList,
      el : $('#history-list-view')
    });

    addon.on('history:reset', items => {
      if (Array.isArray(items)) {
        hl.reset(items.map(i => new HistoryItem(i)));
      }
    });

    // this will help get single history additions
    addon.on('history:add', item => {
      // check if the time for the history item is for the
      // date currently displayed
      if (isSameDay(moment(item.time), moment())) {
        var hi = hl.findWhere({url: item.url});
        if (hi) {
          hi.set(item);
        } else {
          hl.add(new HistoryItem(item), {at: 0});
        }
      }
    });

    // animate a scroll back to the top
    $('a[href=#top]').click(function() {
      $('html, body').animate({scrollTop: 0}, 'slow');
      return false;
    });

    this.router = new HistoryRouter();
    Backbone.history.start({pushState: false});

    // ######### INIT DATE #############
    // This causes our initial load of the current date
    sendQuery({
      date: new Date(),
      query: ''
    });
  }
});

var HistoryApp = new Application({el : $('#history-items')});
