const { Client, GatewayIntentBits, REST, Routes, ActionRowBuilder, ModalBuilder, TextInputBuilder, TextInputStyle, ChannelSelectMenuBuilder, ComponentType } = require('discord.js');
const database = require('./src/database');
const tiktokMonitor = require('./src/tiktokMonitor');
const { commands, PASSWORD } = require('./src/commands');
require('dotenv').config();

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ]
});

const CHECK_INTERVAL = 2 * 60 * 1000;

client.once('ready', async () => {
  console.log(`✅ البوت جاهز! تم تسجيل الدخول باسم ${client.user.tag}`);

  const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);

  try {
    console.log('⏳ جاري تسجيل أوامر السلاش...');

    await rest.put(
      Routes.applicationCommands(client.user.id),
      { body: commands.map(cmd => cmd.data.toJSON()) }
    );

    console.log('✅ تم تسجيل أوامر السلاش بنجاح!');
  } catch (error) {
    console.error('❌ خطأ في تسجيل أوامر السلاش:', error);
  }

  startMonitoring();
});

client.on('interactionCreate', async interaction => {
  if (interaction.isChatInputCommand()) {
    const command = commands.find(cmd => cmd.data.name === interaction.commandName);

    if (!command) return;

    try {
      await command.execute(interaction);
    } catch (error) {
      console.error('خطأ في تنفيذ الأمر:', error);

      const replyMethod = interaction.replied || interaction.deferred ? 'editReply' : 'reply';
      await interaction[replyMethod]({ content: 'حدث خطأ أثناء تنفيذ الأمر!', ephemeral: true });
    }
  }

  if (interaction.isModalSubmit()) {
    const password = interaction.fields.getTextInputValue('passwordInput');

    if (interaction.customId === 'passwordModal') {
      if (password !== PASSWORD) {
        await interaction.reply({ content: '❌ كلمة السر غير صحيحة!', ephemeral: true });
        return;
      }

      const modal = new ModalBuilder()
        .setCustomId('channelInfoModal')
        .setTitle('معلومات قناة TikTok');

      const usernameInput = new TextInputBuilder()
        .setCustomId('usernameInput')
        .setLabel('يوزرنيم قناة TikTok')
        .setStyle(TextInputStyle.Short)
        .setPlaceholder('مثال: mo2026_editor')
        .setRequired(true);

      const videoMessageInput = new TextInputBuilder()
        .setCustomId('videoMessageInput')
        .setLabel('رسالة الفيديو الجديد')
        .setStyle(TextInputStyle.Paragraph)
        .setPlaceholder('مثال: نزل فيديو جديد 🔥')
        .setRequired(true);

      const liveMessageInput = new TextInputBuilder()
        .setCustomId('liveMessageInput')
        .setLabel('رسالة البث المباشر')
        .setStyle(TextInputStyle.Paragraph)
        .setPlaceholder('مثال: القناة بدأت لايف الآن 🔴')
        .setRequired(true);

      modal.addComponents(
        new ActionRowBuilder().addComponents(usernameInput),
        new ActionRowBuilder().addComponents(videoMessageInput),
        new ActionRowBuilder().addComponents(liveMessageInput)
      );

      await interaction.showModal(modal);
    } else if (interaction.customId === 'channelInfoModal') {
      await interaction.deferReply({ ephemeral: true });

      const username = interaction.fields.getTextInputValue('usernameInput');
      const videoMessage = interaction.fields.getTextInputValue('videoMessageInput');
      const liveMessage = interaction.fields.getTextInputValue('liveMessageInput');

      const selectMenu = new ChannelSelectMenuBuilder()
        .setCustomId(`channelSelect_${username}_${Date.now()}`)
        .setPlaceholder('اختر قناة Discord')
        .setChannelTypes([0, 5]);

      const row = new ActionRowBuilder().addComponents(selectMenu);

      const response = await interaction.editReply({
        content: 'اختر قناة Discord التي سيتم النشر فيها:',
        components: [row]
      });

      try {
        const collector = response.createMessageComponentCollector({
          componentType: ComponentType.ChannelSelect,
          time: 60000
        });

        collector.on('collect', async i => {
          if (i.user.id !== interaction.user.id) {
            return i.reply({ content: 'هذه القائمة ليست لك!', ephemeral: true });
          }

          const selectedChannel = i.channels.first();

          try {
            await database.addChannel(username, selectedChannel.id, videoMessage, liveMessage);

            await i.update({
              content: `✅ تمت إضافة قناة **${username}** بنجاح!\nسيتم النشر في: <#${selectedChannel.id}>`,
              components: []
            });

            collector.stop();
          } catch (error) {
            if (error.code === '23505') {
              await i.update({
                content: '❌ هذه القناة مضافة بالفعل!',
                components: []
              });
            } else {
              console.error('خطأ في إضافة القناة:', error);
              await i.update({
                content: '❌ حدث خطأ أثناء إضافة القناة.',
                components: []
              });
            }
            collector.stop();
          }
        });

        collector.on('end', collected => {
          if (collected.size === 0) {
            interaction.editReply({
              content: '❌ انتهى الوقت! لم يتم اختيار قناة.',
              components: []
            });
          }
        });
      } catch (error) {
        console.error('خطأ في المجمع:', error);
      }
    } else if (interaction.customId.startsWith('deletePasswordModal_')) {
      const username = interaction.customId.replace('deletePasswordModal_', '');

      if (password !== PASSWORD) {
        await interaction.reply({ content: '❌ كلمة السر غير صحيحة!', ephemeral: true });
        return;
      }

      await interaction.deferReply();

      try {
        await database.deleteChannel(username);
        await interaction.editReply(`✅ تم حذف قناة **${username}** من المراقبة بنجاح!`);
      } catch (error) {
        console.error('خطأ في حذف القناة:', error);
        await interaction.editReply('❌ حدث خطأ أثناء حذف القناة.');
      }
    }
  }
});

async function startMonitoring() {
  console.log('🔄 بدء نظام المراقبة...');

  setInterval(async () => {
    try {
      const channels = await database.getAllChannels();

      for (const channelData of channels) {
        await checkChannelUpdates(channelData);
      }
    } catch (error) {
      console.error('خطأ في المراقبة:', error);
    }
  }, CHECK_INTERVAL);

  console.log(`✅ نظام المراقبة يعمل! يتم الفحص كل ${CHECK_INTERVAL / 1000} ثانية.`);
}

async function checkChannelUpdates(channelData) {
  try {
    const latestVideo = await tiktokMonitor.getLatestVideo(channelData.tiktok_username);

    if (latestVideo && latestVideo.id !== channelData.last_video_id && channelData.last_video_id !== '') {
      const discordChannel = await client.channels.fetch(channelData.discord_channel_id).catch(() => null);

      if (discordChannel) {
        await discordChannel.send(`@everyone\n${channelData.video_message}\n${latestVideo.url}`);
        console.log(`✅ تم إرسال فيديو جديد من ${channelData.tiktok_username}`);
      }
    }

    if (latestVideo && latestVideo.id !== channelData.last_video_id) {
      await database.updateChannelVideo(channelData.tiktok_username, latestVideo.id);
    }

    const liveStatus = await tiktokMonitor.checkLiveStatus(channelData.tiktok_username);

    if (liveStatus.isLive && !channelData.is_live) {
      const discordChannel = await client.channels.fetch(channelData.discord_channel_id).catch(() => null);

      if (discordChannel) {
        await discordChannel.send(`@everyone\n${channelData.live_message}\n${liveStatus.liveUrl}`);
        console.log(`✅ تم إرسال إشعار بث مباشر من ${channelData.tiktok_username}`);
      }

      await database.updateChannelLiveStatus(channelData.tiktok_username, true);
    } else if (!liveStatus.isLive && channelData.is_live) {
      await database.updateChannelLiveStatus(channelData.tiktok_username, false);
    }
  } catch (error) {
    console.error(`خطأ في فحص ${channelData.tiktok_username}:`, error);
  }
}

client.login(process.env.DISCORD_TOKEN);
