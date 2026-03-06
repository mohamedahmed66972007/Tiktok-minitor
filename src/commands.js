const { SlashCommandBuilder, ChannelType, ActionRowBuilder, ModalBuilder, TextInputBuilder, TextInputStyle, ChannelSelectMenuBuilder } = require('discord.js');
const database = require('./database');
require('dotenv').config();

const PASSWORD = process.env.PASSWORD;

const addChannelCommand = {
  data: new SlashCommandBuilder()
    .setName('اضافة_قناة')
    .setDescription('إضافة قناة TikTok للمراقبة'),

  async execute(interaction) {
    const modal = new ModalBuilder()
      .setCustomId('passwordModal')
      .setTitle('التحقق من كلمة السر');

    const passwordInput = new TextInputBuilder()
      .setCustomId('passwordInput')
      .setLabel('أدخل كلمة السر')
      .setStyle(TextInputStyle.Short)
      .setRequired(true);

    const actionRow = new ActionRowBuilder().addComponents(passwordInput);
    modal.addComponents(actionRow);

    await interaction.showModal(modal);
  }
};

const listChannelsCommand = {
  data: new SlashCommandBuilder()
    .setName('القنوات')
    .setDescription('عرض جميع قنوات TikTok المراقبة'),

  async execute(interaction) {
    await interaction.deferReply();

    try {
      const channels = await database.getAllChannels();

      if (channels.length === 0) {
        return interaction.editReply('لا توجد قنوات مراقبة حالياً.');
      }

      let message = '**قنوات TikTok المراقبة:**\n\n';

      for (const channel of channels) {
        const discordChannel = await interaction.client.channels.fetch(channel.discord_channel_id).catch(() => null);
        const channelName = discordChannel ? `<#${channel.discord_channel_id}>` : 'قناة محذوفة';

        message += `• **${channel.tiktok_username}** → ${channelName}\n`;
      }

      await interaction.editReply(message);
    } catch (error) {
      console.error('خطأ في عرض القنوات:', error);
      await interaction.editReply('حدث خطأ أثناء عرض القنوات.');
    }
  }
};

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
    const modal = new ModalBuilder()
      .setCustomId(`deletePasswordModal_${interaction.options.getString('يوزرنيم')}`)
      .setTitle('التحقق من كلمة السر');

    const passwordInput = new TextInputBuilder()
      .setCustomId('passwordInput')
      .setLabel('أدخل كلمة السر للتأكيد')
      .setStyle(TextInputStyle.Short)
      .setRequired(true);

    const actionRow = new ActionRowBuilder().addComponents(passwordInput);
    modal.addComponents(actionRow);

    await interaction.showModal(modal);
  }
};

module.exports = {
  commands: [addChannelCommand, listChannelsCommand, deleteChannelCommand],
  PASSWORD
};
