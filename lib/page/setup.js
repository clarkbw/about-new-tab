/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */
'use strict';

const { data } = require('sdk/self');
const { getFavicon } = require('sdk/places/favicon');
const tabs = require('sdk/tabs');
const { when: unload } = require('sdk/system/unload');
const prefs = require('sdk/preferences/service');

const page = require('./events');
const database = require('../metadata/database');
const { history, remove, removeDomain } = require('../history');
const { hasBookmark } = require('../bookmarks/utils');
const { events } = require('../history/service');
const { Metadata } = require('../metadata/events');
const { on } = require('sdk/event/core');

// set our new tab page as the default
prefs.set('browser.newtab.url', 'chrome://about-new-tab/content/history.html');

// reset the original new tab on uninstall
unload(reason => {
  if (reason === 'disable' || reason === 'uninstall') {
    prefs.reset('browser.newtab.url');
  }
});

on(events, 'bookmark:added', data => {
  page.emit('url:bookmark', data);
});

on(events, 'bookmark:removed', data => {
  page.emit('bookmark:removed', data);
});

on(events, 'delete', data => {
  page.emit('history:removed', data);
});

on(events, 'visit', data => {
  page.emit('history:add', data);
});

on(events, 'title:changed', data => {
  // history will check for dupes
  page.emit('history:add', data);
});

on(Metadata, 'add', metas => {
  page.emit('url:meta', metas);
});

page.on('open', ({ message: url }) => {
  tabs.open({
    url: url,
    inBackground: true
  });
});

page.on('history:events:delete', ({ message: url }) => {
  // remove actual history
  remove(url);
});

page.on('history:events:delete-related', ({ message: url }) => {
  removeDomain(url);
});

page.on('history:events:query', ({ message, worker }) => {
  history(message).then(results => reset(worker, results));
});

function reset(worker, results) {
  worker.port.emit('history:reset', results);

  results.forEach(({ url }) => {
    getFavicon(url).then(iconUrl => {
      worker.port.emit('url:icon', {
        url: url,
        iconUrl: iconUrl
      });
    });

    database.find(url).then(metas => {
      console.log('metas', metas);
      if (metas && metas.length > 0) {
        metas.forEach(function(meta) {
          worker.port.emit('url:meta', meta);
        });
      }
    });

    hasBookmark(url).then(bookmarked => {
      if (bookmarked) {
        worker.port.emit('url:bookmark', {url: url});
      }
    });
  });
}
