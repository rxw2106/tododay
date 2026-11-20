/* 示例数据已清空。用户新增的待办保存在浏览器 localStorage 中。 */
(function () {
  'use strict';

  window.TodoSeed = {
    create: function () {
      return {
        version: 1,
        createdAt: new Date().toISOString(),
        tasks: []
      };
    }
  };
})();
