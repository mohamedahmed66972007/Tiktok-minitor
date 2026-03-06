const supabase = require('./supabase');

async function addChannel(tiktokUsername, discordChannelId, videoMessage, liveMessage) {
  const { data, error } = await supabase
    .from('tiktok_channels')
    .insert([
      {
        tiktok_username: tiktokUsername,
        discord_channel_id: discordChannelId,
        video_message: videoMessage,
        live_message: liveMessage
      }
    ])
    .select()
    .maybeSingle();

  if (error) throw error;
  return data;
}

async function getAllChannels() {
  const { data, error } = await supabase
    .from('tiktok_channels')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data;
}

async function deleteChannel(tiktokUsername) {
  const { error } = await supabase
    .from('tiktok_channels')
    .delete()
    .eq('tiktok_username', tiktokUsername);

  if (error) throw error;
  return true;
}

async function updateChannelVideo(tiktokUsername, videoId) {
  const { error } = await supabase
    .from('tiktok_channels')
    .update({ last_video_id: videoId })
    .eq('tiktok_username', tiktokUsername);

  if (error) throw error;
  return true;
}

async function updateChannelLiveStatus(tiktokUsername, isLive) {
  const { error } = await supabase
    .from('tiktok_channels')
    .update({ is_live: isLive })
    .eq('tiktok_username', tiktokUsername);

  if (error) throw error;
  return true;
}

module.exports = {
  addChannel,
  getAllChannels,
  deleteChannel,
  updateChannelVideo,
  updateChannelLiveStatus
};
