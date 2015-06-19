/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */
'use strict';

const { Ci } = require('chrome');

const { events } = require('sdk/places/events');
const { EventTarget } = require('sdk/event/target');
const { emit } = require('sdk/event/core');
const { URL } = require('sdk/url');

const TRANSITION_REDIRECT_PERMANENT = Ci.nsINavHistoryService.TRANSITION_REDIRECT_PERMANENT;
const TRANSITION_REDIRECT_TEMPORARY = Ci.nsINavHistoryService.TRANSITION_REDIRECT_TEMPORARY;

const emitter = new EventTarget();

events.on('data', function({type, data}) {
  var uri;
  switch (type) {

    case 'history-visit':
      if (data.transitionType === TRANSITION_REDIRECT_PERMANENT ||
          data.transitionType === TRANSITION_REDIRECT_TEMPORARY) {
        return;
      }
      uri = URL(data.url);
      emit(emitter, 'visit', {
        url : data.url,
        host: uri.host,
        scheme: uri.scheme,
        time : Math.floor(data.time / 1000)
      });
    break;

    case 'history-title-changed':
      uri = URL(data.url);
      emit(emitter, 'title:changed', {
        url : data.url,
        host: uri.host,
        scheme: uri.scheme,
        title : data.title
      });
    break;

    case 'history-delete-url':
      emit(emitter, 'delete', {url : data.url});
    break;

    case 'history-start-clear':
      emit(emitter, 'clear');
    break;

    // bookmarks
    case 'bookmark-item-added':
      emit(emitter, 'bookmark:added', {url : data.url});
    break;

    case 'bookmark-item-removed':
      emit(emitter, 'bookmark:removed', {url : data.url});
    break;
  }
});

exports.events = emitter;
