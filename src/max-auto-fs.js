/**
 * MAX Auto Fullscreen add-on for Firefox and Chrome.
 *
 * For details see README.md
 */

(async () => {
  const log = (...args) => console.log(`MAX Auto-fullscreen:`, ...args);
  const err = (...args) => console.error(`MAX Auto-fullscreen:`, ...args);
  const assert = (condition, ...args) => console.assert(condition, `MAX Auto-fullscreen:`, ...args);

  const app_root = document.querySelector('div#app-root');
  if (!app_root) {
    err('no #app-root');
    return;
  }

  let config = {
    fs_on_short_play: "true"
  };
  const load_config = async () => {
    config = await browser.storage.sync.get(config);
    log('using configuration', config);
  }
  browser.storage.onChanged.addListener(load_config);
  await load_config();

  let reject_running_guard = null;
  const observe_for = (root, condition) => {
    return new Promise((resolve, reject) => {
      const conclude = (observer, result) => {
        reject_running_guard = null;
        observer.disconnect();
        result ? resolve(result) : reject();
      };
      const observer = new MutationObserver(_ => {
        const result = condition(root);
        if (result) {
          conclude(observer, result);
        }
      });
      assert(!reject_running_guard, 'concurrent observers!');
      reject_running_guard = () => conclude(observer);
      observer.observe(root, { subtree: true, childList: true });
    });
  };

  const until_element = (root, selector) => observe_for(root, root => root.querySelector(selector));
  const while_element = (root, selector) => observe_for(root, root => !root.querySelector(selector));

  const guard_for_fullscreen = async (id) => {
    reject_running_guard && reject_running_guard();

    const request_fs = player_root => {
      if (!document.fullscreenElement) {
        log(id, `requesting fullscreen`);
        player_root.requestFullscreen();
      }
    };

    try {
      while (true) {
        const player_screen = app_root.querySelector('div#layer-root-player-screen');
        
        log(id, `started observing for PlayerRootContainer element`);
        const player_root = await until_element(player_screen, 'div[class^="PlayerRootContainer-"]');
        request_fs(player_root);
        
        const video_element = await until_element(player_root, 'video');
        video_element.addEventListener('play', _ => {
          if (config.fs_on_short_play == "true") {
            request_fs(player_root);
          }
        });
        
        log(id, `waiting for player to be removed again`)
        await while_element(player_screen, 'div[class^="PlayerRootContainer-"]');
      }
    } catch(ex) {
      ex && err(id, ex);
    }
    log(id, `exited`);
  };

  let guard_counter = 0;
  window.addEventListener("popstate", _ => guard_for_fullscreen(++guard_counter));
  guard_for_fullscreen(++guard_counter);
})();
