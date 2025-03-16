const { google } = require('googleapis');
const admin = require('firebase-admin');
const { Client, GatewayIntentBits, EmbedBuilder } = require('discord.js');

// Initialize Firebase Admin SDK with your service account key
admin.initializeApp({
    credential: admin.credential.cert('./f999-lms-f084aca87883.json'),
});

// Google Sheets API setup
const auth = new google.auth.GoogleAuth({
    keyFile: './f999-lms-f084aca87883.json',
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
});

const sheets = google.sheets({ version: 'v4', auth });

// Define your Google Spreadsheet ID
const spreadsheetId = '1M7o1YK1VVNae_tW5m1MJORQ2DgMge2taB73qjYJ9_fA';

// Firestore setup
const db = admin.firestore();

// Initialize Discord Client with necessary intents
const discordClient = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
    ],
});

// Login to Discord with the bot token
const botToken = 'MTMyMzM0MjU4MDE0NjExMDU0OA.GGj2-b.8bxG1TvjBTmwKM8uWtUboIFZixicDwcx25D2v4';
discordClient.login(botToken).then(() => {
    console.log('Discord bot logged in successfully.');
}).catch(error => {
    console.error('Error logging into Discord:', error);
});

// Assign Discord Role
async function assignDiscordRole(discordID, roleId) {
    try {
        const guild = await discordClient.guilds.fetch('948318430501699694');
        const member = await guild.members.fetch(discordID);
        const role = await guild.roles.fetch(roleId);

        if (!role) throw new Error(`Role with ID ${roleId} not found.`);
        await member.roles.add(role);
        console.log(`Assigned role ${role.name} to user ${discordID}.`);
    } catch (error) {
        console.error('Error assigning Discord role:', error);
    }
}

// Send Embed Message
async function sendRoleEmbedMessage(discordID, roleId) {
    try {
        const guild = await discordClient.guilds.fetch('948318430501699694');
        const channel = await guild.channels.fetch('1323611050003664977');
        const role = await guild.roles.fetch(roleId);

        if (!role || !channel) throw new Error('Role or Channel not found.');

        const embed = new EmbedBuilder()
            .setColor('#0099ff')
            .setTitle('New Training Completed')
            .setDescription(`<@${discordID}> has completed the **${role.name}** online training and has been automatically assigned the role.`)
            .setTimestamp()
            .setFooter({ text: 'Five999 LMS v2.0.9 Training Logs' });

        await channel.send({ embeds: [embed] });
        console.log(`Embed message sent for user ${discordID}.`);
    } catch (error) {
        console.error('Error sending embed message:', error);
    }
}

// Send Direct Message
async function sendDirectMessage(discordID, roleId) {
    try {
        const guild = await discordClient.guilds.fetch('948318430501699694');
        const role = await guild.roles.fetch(roleId);
        const user = await discordClient.users.fetch(discordID);

        if (!role || !user) throw new Error('Role or User not found.');

        const message = `Congratulations! You have successfully completed the training for **${role.name}**. Your role will be applied within 60 seconds.`;
        await user.send(message);
        console.log(`Direct message sent to user ${discordID}: ${message}`);
    } catch (error) {
        console.error('Error sending direct message:', error);
    }
}

// Update Google Spreadsheet
async function updateSpreadsheet(userId, email, discordID, roleId, completedCourses) {
    try {
        const role = await discordClient.guilds.fetch('948318430501699694')
            .then(guild => guild.roles.fetch(roleId));
        const roleName = role ? role.name : 'Unknown Role';

        const row = [userId, email, discordID, roleName, JSON.stringify(completedCourses)];
        await sheets.spreadsheets.values.append({
            spreadsheetId,
            range: 'Sheet1',
            valueInputOption: 'USER_ENTERED',
            resource: { values: [row] },
        });

        console.log(`Updated spreadsheet for user ${discordID}.`);
    } catch (error) {
        console.error('Error updating spreadsheet:', error);
    }
}

// Firestore Listener
db.collection('users').onSnapshot(async (snapshot) => {
    snapshot.docChanges().forEach(async (change) => {
        const userDoc = change.doc;
        const userData = userDoc.data();
        const discordID = userData.discordID;
        const completedCourses = userData.completedCourses || [];
        const previousCourses = userData.previousCompletedCourses || [];
        const email = userData.email;

        if (change.type === 'modified' || change.type === 'added') {
            const newCourses = completedCourses.filter(course => !previousCourses.includes(course));

            for (const courseId of newCourses) {
                await assignDiscordRole(discordID, courseId);
                await sendRoleEmbedMessage(discordID, courseId);
                await sendDirectMessage(discordID, courseId);
                await updateSpreadsheet(userDoc.id, email, discordID, courseId, completedCourses);
            }

            await db.collection('users').doc(userDoc.id).update({
                previousCompletedCourses: completedCourses,
            });
        }
    });
});

console.log('Listening for Firestore changes...');
