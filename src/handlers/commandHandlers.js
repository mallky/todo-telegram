const { Task } = require("../models/Task");

const addTask = async (bot, msg, match) => {
  if (!msg || !msg.chat) {
    console.error("Invalid message object received");
    return;
  }
  const chatId = msg.chat.id;
  const userId = msg.from?.id?.toString() || "";

  try {
    // Step 1: Ask for task text
    bot.sendMessage(chatId, "Please enter your task text:");

    let taskData = {};

    // Handle task text
    bot.once("message", async (textMsg) => {
      try {
        taskData.text = textMsg.text.trim();

        // Step 2: Ask for priority with radio buttons
        const priorityOptions = {
          reply_markup: {
            inline_keyboard: [
              [
                { text: "🔴 High", callback_data: "priority_high" },
                { text: "🟡 Medium", callback_data: "priority_medium" },
                { text: "🟢 Low", callback_data: "priority_low" },
              ],
            ],
          },
        };

        bot.sendMessage(chatId, "Select task priority:", priorityOptions);
      } catch (error) {
        console.log(error);
      }
    });

    // Handle priority selection
    bot.on("callback_query", async (callbackQuery) => {
      try {
        if (!callbackQuery.data.startsWith("priority_")) return;

        const priority = callbackQuery.data.replace("priority_", "");
        taskData.priority = priority;

        // Acknowledge the callback
        await bot.answerCallbackQuery(callbackQuery.id);
        await bot.deleteMessage(chatId, callbackQuery.message.message_id);
        await bot.sendMessage(chatId, `Priority set to: ${priority}`);

        // Step 3: Show calendar for due date
        const today = new Date();
        const calendar = {
          reply_markup: {
            inline_keyboard: generateCalendar(today),
          },
        };

        bot.sendMessage(chatId, "Select due date:", calendar);
      } catch (error) {
        console.log(error);
      }
    });

    // Handle date selection
    bot.on("callback_query", async (callbackQuery) => {
      try {
        if (!callbackQuery.data.startsWith("date_")) return;

        const selectedDate = new Date(callbackQuery.data.replace("date_", ""));
        taskData.dueDate = selectedDate;

        // Create the task
        await Task.create({
          userId,
          text: taskData.text,
          priority: taskData.priority,
          dueDate: taskData.dueDate,
        });

        // Cleanup and confirmation
        await bot.answerCallbackQuery(callbackQuery.id);
        await bot.deleteMessage(chatId, callbackQuery.message.message_id);
        await bot.sendMessage(chatId, "✅ Task added successfully!");
      } catch (error) {
        console.log(error);
      }
    });
  } catch (error) {
    console.error(error);
    bot.sendMessage(chatId, "❌ Error adding task. Please try again.");
  }
};

// Helper function to generate calendar
const generateCalendar = (date) => {
  const calendar = [];
  const daysInMonth = new Date(
    date.getFullYear(),
    date.getMonth() + 1,
    0
  ).getDate();
  const firstDay = new Date(date.getFullYear(), date.getMonth(), 1).getDay();

  // Add month and year header
  calendar.push([
    {
      text: `${date.toLocaleString("default", {
        month: "long",
      })} ${date.getFullYear()}`,
      callback_data: "ignore",
    },
  ]);

  // Add day names header
  calendar.push(
    ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"].map((day) => ({
      text: day,
      callback_data: "ignore",
    }))
  );

  // Add calendar days
  let currentRow = new Array(7).fill(null);
  let currentDay = 1;

  // Fill in the days
  for (let i = 0; i < 42; i++) {
    const col = i % 7;
    const row = Math.floor(i / 7);

    if (i < firstDay || currentDay > daysInMonth) {
      currentRow[col] = { text: " ", callback_data: "ignore" };
    } else {
      const dateStr = new Date(
        date.getFullYear(),
        date.getMonth(),
        currentDay
      ).toISOString();
      currentRow[col] = {
        text: currentDay.toString(),
        callback_data: `date_${dateStr}`,
      };
      currentDay++;
    }

    if (col === 6) {
      calendar.push(currentRow);
      currentRow = new Array(7).fill(null);
    }
  }

  return calendar;
};

const listTasks = async (bot, msg) => {
  if (!msg || !msg.chat || !msg.from) {
    console.error("Invalid message object received");
    return;
  }
  const chatId = msg.chat.id;
  const userId = msg.from.id.toString();

  try {
    const tasks = await Task.findByUserId(userId);
    if (
      !tasks ||
      !Array.isArray(tasks) ||
      (Array.isArray(tasks) && tasks.length === 0)
    ) {
      return bot.sendMessage(chatId, "You have no tasks yet!");
    }

    const taskList = tasks
      .map((task) => {
        return `${task.completed ? "✅" : "⭕"} ${task.text}\nPriority: ${
          task.priority
        }\nDue: ${new Date(task.due_date).toLocaleDateString()}\nID: ${
          task.id
        }\n`;
      })
      .join("\n");

    bot.sendMessage(chatId, `📝 Your Tasks:\n\n${taskList}`);
  } catch (error) {
    bot.sendMessage(chatId, "❌ Error fetching tasks. Please try again.");
  }
};

const todayTasks = async (bot, msg) => {
  if (!msg || !msg.chat || !msg.from) {
    console.error("Invalid message object received");
    return;
  }
  const chatId = msg.chat.id;
  const userId = msg.from.id.toString();

  try {
    const tasks = await Task.findTodayTasks(userId);

    if (!Array.isArray(tasks) || (Array.isArray(tasks) && tasks.length === 0)) {
      return bot.sendMessage(chatId, "No tasks for today!");
    }

    const taskList = tasks
      .map((task) => {
        return `${task.completed ? "✅" : "⭕"} ${task.text}\nPriority: ${
          task.priority
        }\nID: ${task.id}`;
      })
      .join("\n\n");

    bot.sendMessage(chatId, `📅 Today's Tasks:\n\n${taskList}`);
  } catch (error) {
    bot.sendMessage(
      chatId,
      "❌ Error fetching today's tasks. Please try again."
    );
  }
};

const monthTasks = async (bot, msg) => {
  if (!msg || !msg.chat || !msg.from) {
    console.error("Invalid message object received");
    return;
  }
  const chatId = msg.chat.id;
  const userId = msg.from.id.toString();

  try {
    const tasks = await Task.findMonthTasks(userId);

    if (!Array.isArray(tasks) || (Array.isArray(tasks) && tasks.length === 0)) {
      return bot.sendMessage(chatId, "No tasks for this month!");
    }

    const taskList = tasks
      .map((task) => {
        return `📅 ${new Date(task.due_date).toLocaleDateString()}\n${
          task.completed ? "✅" : "⭕"
        } ${task.text}\nPriority: ${task.priority}\nID: ${task.id}`;
      })
      .join("\n\n");

    bot.sendMessage(chatId, `📅 This Month's Tasks:\n\n${taskList}`);
  } catch (error) {
    bot.sendMessage(
      chatId,
      "❌ Error fetching month's tasks. Please try again."
    );
  }
};

const deleteTask = async (bot, msg, match) => {
  if (!msg || !msg.chat || !msg.from) {
    console.error("Invalid message object received");
    return;
  }
  const chatId = msg.chat.id;
  const userId = msg.from.id.toString();

  try {
    const tasks = await Task.findByUserId(userId);
    if (
      !tasks ||
      !Array.isArray(tasks) ||
      (Array.isArray(tasks) && tasks.length === 0)
    ) {
      return bot.sendMessage(chatId, "You have no tasks to delete!");
    }

    const inlineKeyboard = tasks.map((task) => [
      {
        text: `${task.completed ? "✅" : "⭕"} ${task.text} (Due: ${new Date(
          task.due_date
        ).toLocaleDateString()})`,
        callback_data: `delete_${task.id}`,
      },
    ]);

    bot.sendMessage(chatId, "Select a task to delete:", {
      reply_markup: {
        inline_keyboard: inlineKeyboard,
      },
    });

    // Handle callback for task deletion
    bot.on("callback_query", async (callbackQuery) => {
      try {
        if (!callbackQuery.data.startsWith("delete_")) return;

        const taskId = parseInt(callbackQuery.data.replace("delete_", ""));
        const deleted = await Task.delete(taskId, userId);

        await bot.answerCallbackQuery(callbackQuery.id);
        await bot.deleteMessage(chatId, callbackQuery.message.message_id);

        if (deleted) {
          bot.sendMessage(chatId, "✅ Task deleted successfully!");
        } else {
          bot.sendMessage(
            chatId,
            "❌ Task not found or you don't have permission to delete it."
          );
        }
      } catch (error) {
        console.log(error);
      }
    });
  } catch (error) {
    console.error(error);
    bot.sendMessage(chatId, "❌ Error deleting task. Please try again.");
  }
};

const markTaskDone = async (bot, msg, match) => {
  if (!msg || !msg.chat || !msg.from) {
    console.error("Invalid message object received");
    return;
  }
  const chatId = msg.chat.id;
  const userId = msg.from.id.toString();

  try {
    const tasks = await Task.findByUserId(userId);
    if (
      !tasks ||
      !Array.isArray(tasks) ||
      (Array.isArray(tasks) && tasks.length === 0)
    ) {
      return bot.sendMessage(chatId, "You have no tasks to mark as done!");
    }

    const inlineKeyboard = tasks.map((task) => [
      {
        text: `${task.completed ? "✅" : "⭕"} ${task.text} (Due: ${new Date(
          task.due_date
        ).toLocaleDateString()})`,
        callback_data: `done_${task.id}`,
      },
    ]);

    bot.sendMessage(chatId, "Select a task to mark as done:", {
      reply_markup: {
        inline_keyboard: inlineKeyboard,
      },
    });

    // Handle callback for marking task as done
    bot.on("callback_query", async (callbackQuery) => {
      try {
        if (!callbackQuery.data.startsWith("done_")) return;

        const taskId = parseInt(callbackQuery.data.replace("done_", ""));
        const marked = await Task.markAsDone(taskId, userId);

        await bot.answerCallbackQuery(callbackQuery.id);
        await bot.deleteMessage(chatId, callbackQuery.message.message_id);

        if (marked) {
          bot.sendMessage(chatId, "✅ Task marked as done!");
        } else {
          bot.sendMessage(
            chatId,
            "❌ Task not found or you don't have permission to update it."
          );
        }
      } catch (error) {
        console.log(error);
      }
    });
  } catch (error) {
    console.error(error);
    bot.sendMessage(chatId, "❌ Error updating task. Please try again.");
  }
};

module.exports = {
  addTask,
  listTasks,
  todayTasks,
  monthTasks,
  deleteTask,
  markTaskDone,
};
