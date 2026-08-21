const { BASE_URL } = require('../config/index');

function request(options) {
  const { url, method = 'GET', data = {}, timeout = 15000 } = options;
  return new Promise((resolve, reject) => {
    wx.request({
      url: BASE_URL + url,
      method,
      data,
      timeout,
      header: { 'Content-Type': 'application/json' },
      success(res) {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve(res.data);
        } else {
          reject(new Error('请求失败(' + res.statusCode + '): ' + url));
        }
      },
      fail(err) {
        reject(err);
      }
    });
  });
}

function get(url, data = {}) {
  return request({ url, data });
}

module.exports = { request, get };
