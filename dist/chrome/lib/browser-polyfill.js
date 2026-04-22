/**
 * browser-polyfill.js
 * Lightweight abstraction layer for cross-browser compatibility.
 * Maps `browser.*` API to `chrome.*` in Chromium-based environments.
 */

(function () {
  'use strict';

  if (typeof globalThis.browser !== 'undefined') return; // Firefox already has browser.*

  const chromeToPromise = (fn) => (...args) =>
    new Promise((resolve, reject) => {
      fn(...args, (result) => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
        } else {
          resolve(result);
        }
      });
    });

  globalThis.browser = {
    runtime: {
      sendMessage: chromeToPromise(chrome.runtime.sendMessage.bind(chrome.runtime)),
      onMessage: chrome.runtime.onMessage,
      getURL: chrome.runtime.getURL.bind(chrome.runtime),
      id: chrome.runtime.id,
    },
    storage: {
      local: {
        get: chromeToPromise(chrome.storage.local.get.bind(chrome.storage.local)),
        set: chromeToPromise(chrome.storage.local.set.bind(chrome.storage.local)),
        remove: chromeToPromise(chrome.storage.local.remove.bind(chrome.storage.local)),
        clear: chromeToPromise(chrome.storage.local.clear.bind(chrome.storage.local)),
      },
    },
    tabs: {
      query: chromeToPromise(chrome.tabs.query.bind(chrome.tabs)),
      sendMessage: chromeToPromise(chrome.tabs.sendMessage.bind(chrome.tabs)),
    },
    alarms: {
      create: chrome.alarms.create.bind(chrome.alarms),
      clear: chromeToPromise(chrome.alarms.clear.bind(chrome.alarms)),
      onAlarm: chrome.alarms.onAlarm,
    },
    notifications: {
      create: chromeToPromise(chrome.notifications.create.bind(chrome.notifications)),
    },
  };
})();
