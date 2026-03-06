const {
  SlashCommandBuilder,
  ActionRowBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle
} = require('discord.js');

const database = require('./database');
require('dotenv').config();

const PASSWORD = process.env.PASSWORD;

/* ======================
   ADD CHANNEL
====================== */

const addChannelCommand = {
  data: new SlashCommandBuilder()
    .setName('اضافة_قناة')
    .setDescription('إضافة قناة TikTok للمراقبة'),

  async execute(interaction) {

    const modal = new ModalBuilder()
      .setCustomId('addChannelModal')
      .setTitle('إضافة قناة TikTok');

    const passwordInput = new TextInputBuilder()
      .setCustomId('passwordInput')
      .setLabel('كلمة السر')
      .setStyle(TextInputStyle.Short)
      .setRequired(true);

    const usernameInput = new TextInputBuilder()
      .setCustomId('usernameInput')
      .setLabel('يوزرنيم قناة TikTok')
      .setStyle(TextInputStyle.Short)
      .setPlaceholder('example_user')
      .setRequired(true);

    const videoMessageInput = new TextInputBuilder()
      .setCustomId('videoMessageInput')
      .setLabel('رسالة الفيديو الجديد')
      .setStyle(TextInputStyle.Paragraph)
      .setPlaceholder('نزل فيديو جديد 🔥')
      .setRequired(true);

    const liveMessageInput = new TextInputBuilder()
      .setCustomId('liveMessageInput')
      .setLabel('رسالة البث المباشر')
      .setStyle(TextInputStyle.Paragraph)
      .setPlaceholder('القناة بدأت بث مباشر 🔴')
      .setRequired(true);

    modal.addComponents(
      new ActionRowBuilder().addComponents(passwordInput),
      new ActionRowBuilder().addComponents(usernameInput),
      new ActionRowBuilder().addComponents(videoMessageInput),
      new ActionRowBuilder().addComponents(liveMessageInput)
    );

    await interaction.showModal(modal);
  }
};

/* ======================
   LIST CHANNELS
====================== */

const listChannelsCommand = {
  data: new SlashCommandBuilder()
    .setName('القنوات')
    .setDescription('عرض جميع قنوات TikTok المراقبة'),

  async execute(interaction) {

    await interaction.deferReply();

    try {

      const channels = await database.getAllChannels();

      if (!channels.length) {
        return interaction.editReply('لا توجد قنوات مراقبة حالياً.');
      }

      let message = '**قنوات TikTok المراقبة:**\n\n';

      for (const channel of channels) {

        const discordChannel = await interaction.client.channels
          .fetch(channel.discord_channel_id)
          .catch(() => null);

        const channelName = discordChannel
          ? `<#${channel.discord_channel_id}>`
          : 'قناة محذوفة';

        message += `• **${channel.tiktok_username}** → ${channelName}\n`;
      }

      await interaction.editReply(message);

    } catch (error) {

      console.error(error);
      await interaction.editReply('❌ حدث خطأ أثناء عرض القنوات');

    }

  }
};

/* ======================
   DELETE CHANNEL
====================== */

const deleteChannelCommand = {
  data: new SlashCommandBuilder()
    .setName('حذف')
    .setDescription('حذف قناة TikTok من المراقبة')
    .addStringOption(option =>
      option
        .setName('يوزرنيم')
        .setDescription('يوزرنيم قناة TikTok')
        .setRequired(true)
    ),

  async execute(interaction) {

    const username = interaction.options.getString('يوزرنيم');

    const modal = new ModalBuilder()
      .setCustomId(`deletePasswordModal_${username}`)
      .setTitle('تأكيد الحذف');

    const passwordInput = new TextInputBuilder()
      .setCustomId('passwordInput')
      .setLabel('أدخل كلمة السر للتأكيد')
      .setStyle(TextInputStyle.Short)
      .setRequired(true);

    modal.addComponents(
      new ActionRowBuilder().addComponents(passwordInput)
    );

    await interaction.showModal(modal);

  }
};

/* ======================
   EXPORT
====================== */

module.exports = {
  commands: [
    addChannelCommand,
    listChannelsCommand,
    deleteChannelCommand
  ],
  PASSWORD
};