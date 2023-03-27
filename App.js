require('dotenv').config();
const axios = require('axios');
const Discord = require('discord.js');
const debug = require('debug')('myapp:debug');

const webhook = new Discord.WebhookClient({ url: process.env.DISCORD_WEBHOOK_URL });

async function fetchRecentlySoldNFTs() {
  debug('Fetching data from Magic Eden API...');

  const response = await axios.get('https://api.magiceden.io/marketplace/recently_sold', {
    params: {
      limit: 100,
    },
  });

  debug('Successfully fetched data from Magic Eden API');

  const currentTime = new Date().getTime();
  const fiveMinutesAgo = currentTime - 5 * 60 * 1000;

  return response.data.data.filter(
    (item) => new Date(item.time * 1000).getTime() >= fiveMinutesAgo
  );
}

async function fetchTopTenProjects() {
  const recentlySoldNFTs = await fetchRecentlySoldNFTs();
  const projects = {};

  recentlySoldNFTs.forEach((nft) => {
    const { price, name } = nft;
    if (!projects[name]) {
      projects[name] = {
        count: 0,
        totalValue: 0,
        minPrice: Infinity,
        maxPrice: 0,
      };
    }

    projects[name].count++;
    projects[name].totalValue += parseFloat(price);
    projects[name].minPrice = Math.min(projects[name].minPrice, parseFloat(price));
    projects[name].maxPrice = Math.max(projects[name].maxPrice, parseFloat(price));
  });

  return Object.entries(projects)
    .sort(([, a], [, b]) => b.count - a.count)
    .slice(0, 10)
    .map(([name, data]) => ({ name, ...data }));
}

async function sendEmbedMessage(topTenProjects) {
  const embed = new Discord.MessageEmbed()
    .setTitle('Top 10 Projects on Magic Eden (Last 5 minutes)')
    .setColor('#0099ff')
    .setTimestamp();

  topTenProjects.forEach((project, index) => {
    embed.addField(
      `${index + 1}. ${project.name}`,
      `Sold: ${project.count}\nTotal Value: Ξ${project.totalValue.toFixed(2)}\nMin Price: Ξ${project.minPrice.toFixed(
        2
      )}\nMax Price: Ξ${project.maxPrice.toFixed(2)}`
    );
  });

  await webhook.send({ embeds: [embed] });
}

(async () => {
  try {
    const topTenProjects = await fetchTopTenProjects();
    await sendEmbedMessage(topTenProjects);
  } catch (error) {
    console.error('Error fetching data or sending message:', error);
    debug('Error fetching data or sending message:', error);
  }
})();
