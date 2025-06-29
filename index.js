const { Client, GatewayIntentBits, SlashCommandBuilder, ActionRowBuilder, ModalBuilder, TextInputBuilder, TextInputStyle, EmbedBuilder, ButtonBuilder, ButtonStyle, Events, Collection, REST, Routes } = require('discord.js');
const fs = require('fs');
require('dotenv').config();

const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers] });

const registrosPath = './data/registros.json';
if (!fs.existsSync(registrosPath)) fs.writeFileSync(registrosPath, '{}');
let registros = JSON.parse(fs.readFileSync(registrosPath));

client.once('ready', () => {
  console.log(`🤖 Online como ${client.user.tag}`);
});

client.on('ready', async () => {
  const commands = [
    new SlashCommandBuilder()
      .setName('registrar')
      .setDescription('Registrar-se como membro')
  ].map(cmd => cmd.toJSON());

  const rest = new REST({ version: '10' }).setToken(process.env.TOKEN);
  await rest.put(
    Routes.applicationGuildCommands(process.env.CLIENT_ID, process.env.GUILD_ID),
    { body: commands }
  );

  console.log('✅ Comando /registrar registrado');
});

client.on(Events.InteractionCreate, async interaction => {
  if (interaction.isChatInputCommand() && interaction.commandName === 'registrar') {
    if (registros[interaction.user.id]) {
      return interaction.reply({ content: '❌ Você já enviou um registro. Aguarde aprovação.', ephemeral: true });
    }

    const modal = new ModalBuilder()
      .setCustomId('form_registro')
      .setTitle('Registro de Membro');

    const idInput = new TextInputBuilder()
      .setCustomId('jogador_id')
      .setLabel('ID do Jogador (FiveM)')
      .setStyle(TextInputStyle.Short)
      .setRequired(true);

    const facInput = new TextInputBuilder()
      .setCustomId('fac_nome')
      .setLabel('Nome da Facção')
      .setStyle(TextInputStyle.Short)
      .setRequired(true);

    const cargoInput = new TextInputBuilder()
      .setCustomId('fac_cargo')
      .setLabel('Cargo (ex: 01, 02)')
      .setStyle(TextInputStyle.Short)
      .setRequired(true);

    const row1 = new ActionRowBuilder().addComponents(idInput);
    const row2 = new ActionRowBuilder().addComponents(facInput);
    const row3 = new ActionRowBuilder().addComponents(cargoInput);

    await interaction.showModal(modal.addComponents(row1, row2, row3));
  }

  if (interaction.isModalSubmit() && interaction.customId === 'form_registro') {
    const id = interaction.fields.getTextInputValue('jogador_id');
    const fac = interaction.fields.getTextInputValue('fac_nome');
    const cargo = interaction.fields.getTextInputValue('fac_cargo');

    registros[interaction.user.id] = { id, fac, cargo };
    fs.writeFileSync(registrosPath, JSON.stringify(registros, null, 2));

    const embed = new EmbedBuilder()
      .setTitle('📥 Nova Solicitação de Registro')
      .addFields(
        { name: '👤 Usuário', value: `<@${interaction.user.id}>`, inline: true },
        { name: '🆔 ID', value: id, inline: true },
        { name: '🏴 Facção', value: fac, inline: true },
        { name: '🎖 Cargo', value: cargo, inline: true }
      )
      .setColor('Red')
      .setTimestamp();

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId(`aprovar_${interaction.user.id}`).setLabel('Aprovar').setStyle(ButtonStyle.Success),
      new ButtonBuilder().setCustomId(`recusar_${interaction.user.id}`).setLabel('Recusar').setStyle(ButtonStyle.Danger)
    );

    const canal = await client.channels.fetch(process.env.CANAL_ANALISE);
    await canal.send({ embeds: [embed], components: [row] });

    await interaction.reply({ content: '✅ Sua solicitação foi enviada para análise da staff.', ephemeral: true });
  }

  if (interaction.isButton()) {
    const [acao, userId] = interaction.customId.split('_');
    const membro = await interaction.guild.members.fetch(userId).catch(() => null);
    if (!membro) return interaction.reply({ content: '❌ Membro não encontrado.', ephemeral: true });

    if (acao === 'aprovar') {
      await membro.roles.add(process.env.CARGO_MEMBRO);
      await interaction.update({ content: `✅ Registro de <@${userId}> aprovado. Cargo atribuído.`, embeds: [], components: [] });
    } else if (acao === 'recusar') {
      await interaction.update({ content: `❌ Registro de <@${userId}> recusado pela staff.`, embeds: [], components: [] });
    }

    delete registros[userId];
    fs.writeFileSync(registrosPath, JSON.stringify(registros, null, 2));
  }
});

client.login(process.env.TOKEN);
