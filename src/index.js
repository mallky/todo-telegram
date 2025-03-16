require("dotenv").config();
const TelegramBot = require("node-telegram-bot-api");
const { Task, pool } = require("./models/Task");
const schedule = require("node-schedule");
const {
  addTask,
  listTasks,
  todayTasks,
  monthTasks,
  deleteTask,
  markTaskDone,
} = require("./handlers/commandHandlers");

// Initialize bot
const bot = new TelegramBot(process.env.BOT_TOKEN, { polling: true });

// Initialize database
Task.initTable()
  .then(() => console.log("Database initialized"))
  .catch((err) => console.error("Database initialization error:", err));

// Command handlers with menu
bot.onText(/\/start|\/menu/, (msg) => {
  const chatId = msg.chat.id;
  const options = {
    reply_markup: {
      keyboard: [
        [{ text: "📝 Add Task" }, { text: "📋 List Tasks" }],
        [{ text: "📅 Today's Tasks" }, { text: "📆 Monthly Tasks" }],
        [{ text: "✅ Mark Done" }, { text: "❌ Delete Task" }],
      ],
      resize_keyboard: true,
      one_time_keyboard: false,
    },
  };

  bot.sendMessage(
    chatId,
    "Welcome to Todo Manager Bot! 📝\nSelect an action from the menu below:",
    options
  );
});

// Handle menu button clicks
bot.on("message", (msg) => {
  switch (msg.text) {
    case "📝 Add Task":
      addTask(bot, msg);
      break;
    case "📋 List Tasks":
      listTasks(bot, msg);
      break;
    case "📅 Today's Tasks":
      todayTasks(bot, msg);
      break;
    case "📆 Monthly Tasks":
      monthTasks(bot, msg);
      break;
    case "✅ Mark Done":
      markTaskDone(bot, msg);
      break;
    case "❌ Delete Task":
      deleteTask(bot, msg);
      break;
  }
});

// Keep the original command handlers for backward compatibility
bot.onText(/\/add/, (...args) => addTask(bot, ...args));
bot.onText(/\/list/, (...args) => listTasks(bot, ...args));
bot.onText(/\/today/, (...args) => todayTasks(bot, ...args));
bot.onText(/\/month/, (...args) => monthTasks(bot, ...args));
bot.onText(/\/delete/, (...args) => deleteTask(bot, ...args));
bot.onText(/\/done/, (...args) => markTaskDone(bot, ...args));

// Error handling
bot.on("polling_error", (error) => {
  console.error(error);
});

// Schedule daily reminders for tomorrow's tasks
const sendTomorrowTaskReminders = async () => {
  try {
    // Get all unique user IDs from the database
    const [users] = await pool.execute("SELECT DISTINCT user_id FROM tasks");

    for (const user of users) {
      const userId = user.user_id;
      const tomorrowTasks = await Task.findTomorrowTasks(userId);

      if (tomorrowTasks.length > 0) {
        const taskList = tomorrowTasks
          .map((task) => `🎯 ${task.text}\nPriority: ${task.priority}`)
          .join("\n\n");

        const message = `👋 Friendly reminder!\n\nYou have ${
          tomorrowTasks.length
        } task${
          tomorrowTasks.length > 1 ? "s" : ""
        } scheduled for tomorrow:\n\n${taskList}\n\nHave a great day! 🌟`;

        await bot.sendMessage(userId, message);
      }
    }
  } catch (error) {
    console.error("Error sending reminders:", error);
  }
};

// Schedule reminders to run every day at 8:00 AM and 8:00 PM
schedule.scheduleJob("0 8 * * *", sendTomorrowTaskReminders);
schedule.scheduleJob("0 20 * * *", sendTomorrowTaskReminders);

console.log("Bot is running...");
