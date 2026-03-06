const axios = require('axios');

async function getTikTokUserInfo(username) {
  try {
    const response = await axios.get(`https://www.tiktok.com/@${username}`, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
      }
    });

    const html = response.data;

    const scriptMatch = html.match(/<script id="__UNIVERSAL_DATA_FOR_REHYDRATION__" type="application\/json">(.*?)<\/script>/);

    if (scriptMatch) {
      const data = JSON.parse(scriptMatch[1]);
      const userInfo = data['__DEFAULT_SCOPE__']['webapp.user-detail'];

      if (userInfo && userInfo.userInfo) {
        return {
          user: userInfo.userInfo.user,
          stats: userInfo.userInfo.stats,
          isLive: userInfo.userInfo.user.roomId ? true : false
        };
      }
    }

    return null;
  } catch (error) {
    console.error(`خطأ في جلب معلومات ${username}:`, error.message);
    return null;
  }
}

async function getLatestVideo(username) {
  try {
    const userInfo = await getTikTokUserInfo(username);

    if (!userInfo) return null;

    const response = await axios.get(`https://www.tiktok.com/api/post/item_list/?aid=1988&count=10&secUid=${userInfo.user.secUid}`, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
      }
    });

    if (response.data && response.data.itemList && response.data.itemList.length > 0) {
      const latestVideo = response.data.itemList[0];
      return {
        id: latestVideo.id,
        desc: latestVideo.desc,
        createTime: latestVideo.createTime,
        url: `https://www.tiktok.com/@${username}/video/${latestVideo.id}`
      };
    }

    return null;
  } catch (error) {
    console.error(`خطأ في جلب آخر فيديو لـ ${username}:`, error.message);
    return null;
  }
}

async function checkLiveStatus(username) {
  try {
    const userInfo = await getTikTokUserInfo(username);

    if (!userInfo) return { isLive: false };

    const isLive = userInfo.isLive;
    const liveUrl = isLive ? `https://www.tiktok.com/@${username}/live` : null;

    return {
      isLive: isLive,
      liveUrl: liveUrl
    };
  } catch (error) {
    console.error(`خطأ في التحقق من البث المباشر لـ ${username}:`, error.message);
    return { isLive: false };
  }
}

module.exports = {
  getTikTokUserInfo,
  getLatestVideo,
  checkLiveStatus
};
