const express = require("express");
const { Telegraf, Markup } = require("telegraf");
require("dotenv").config();

const app = express();
const bot = new Telegraf(process.env.BOT_TOKEN);
const adminGroupId = process.env.ADMIN_GROUP_ID;

// Health check route
app.get("/", (req, res) => {
    res.send("Bot is running!");
});

// Set webhook URL
const setWebhook = async () => {
    const webhookUrl = `${
        process.env.NODE_ENV === "production" ? process.env.SERVER_URL : process.env.NGROK_SERVER_URL
    }/bot${process.env.BOT_TOKEN}`;
    try {
        await bot.telegram.deleteWebhook().then(() => {
            console.log("Webhook deleted");
        });
        await bot.telegram.setWebhook(webhookUrl);
        console.log(`Webhook set to: ${webhookUrl}`);
    } catch (error) {
        console.error("Error setting webhook:", error);
    }
};
setWebhook();

app.use(express.json());
app.use(bot.webhookCallback(`/bot${process.env.BOT_TOKEN}`));

const userSessions = {};
const activeRegistrations = {};

const REGISTRATION_STEPS = {
    PASSPORT: {
        message:
            "Введите данные паспорта в формате:\nФИО: Marcus Aurelius\nСерийный номер: XXXXXX\nДата рождения: DD.MM.YYYY",
        next: "LICENSE",
    },
    LICENSE: {
        message:
            "Введите данные водительского удостоверения в формате:\nСерия: XXXX\nНомер: XXXXXX\nДата выдачи: DD.MM.YYYY\nКатегории: ...",
        next: "TECH_PASSPORT",
    },
    TECH_PASSPORT: {
        message:
            "Введите данные технического паспорта в формате:\nСерия: XXX\nНомер: XXXXXX\nГод выпуска: YYYY\nМарка и модель: ...",
        next: "PHONE",
    },
    PHONE: {
        message: "Пожалуйста, отправьте ваш рабочий номер телефона",
        next: null,
    },
};

bot.start((ctx) => {
    userSessions[ctx.from.id] = {
        step: "PASSPORT",
        data: {},
    };
    ctx.reply(REGISTRATION_STEPS.PASSPORT.message);
});

bot.on("text", (ctx) => {
    const session = userSessions[ctx.from.id];

    if (!session) {
        return ctx.reply("Пожалуйста, начните регистрацию с команды /start.");
    }

    // Handle phone number input without contact sharing
    if (session.step === "PHONE") {
        return ctx.reply(
            "Пожалуйста, используйте кнопку ниже, чтобы отправить ваш номер телефона 👇",
            Markup.keyboard([Markup.button.contactRequest("📞 Отправить контакт")])
                .oneTime()
                .resize()
        );
    }

    // Handle document data input
    session.data[session.step.toLowerCase()] = ctx.message.text;
    const nextStep = REGISTRATION_STEPS[session.step].next;

    if (nextStep) {
        session.step = nextStep;
        ctx.reply(
            REGISTRATION_STEPS[nextStep].message,
            nextStep === "PHONE"
                ? Markup.keyboard([Markup.button.contactRequest("📞 Отправить контакт")])
                      .oneTime()
                      .resize()
                : undefined // Для других шагов клавиатуру не отправляем
        );
    }
});

bot.on("contact", async (ctx) => {
    const session = userSessions[ctx.from.id];

    if (!session || session.step !== "PHONE") {
        return ctx.reply("Пожалуйста, следуйте инструкциям и отправьте данные корректно.");
    }

    // 🔽 Сохраняем номер телефона из контакта
    session.data.phone = ctx.message.contact.phone_number;

    // 🔽 Отправляем данные в группу администраторов
    sendToAdminGroup(ctx, session.data);
    delete userSessions[ctx.from.id]; // Удаляем сессию пользователя

    // 🔽 Уведомляем пользователя и убираем клавиатуру
    return ctx.reply("Ваши данные отправлены на проверку. Ожидайте ответа.", Markup.removeKeyboard());
});

async function sendToAdminGroup(ctx, data) {
    const messageText = `
Новая заявка на регистрацию:

Статус: НЕ ВЫПОЛНЯЕТСЯ 🔴`;

    const message = await ctx.telegram.sendMessage(
        adminGroupId,
        messageText,
        Markup.inlineKeyboard([[Markup.button.callback("Начать регистрацию", `start_${ctx.from.id}`)]])
    );

    userSessions[ctx.from.id] = data;
}

bot.action(/start_(\d+)/, async (ctx) => {
    const userId = ctx.match[1];
    const adminId = ctx.from.id;
    const data = userSessions[userId];

    if (activeRegistrations[userId]) {
        return ctx.answerCbQuery("Регистрация уже выполняется другим администратором.");
    }

    activeRegistrations[userId] = adminId;

    // Forward data to admin's private chat
    await ctx.telegram.sendMessage(
        adminId,
        `Данные заявителя:
🔹 Паспорт:
${data.passport}

🔹 Водительское удостоверение:
${data.license}

🔹 Технический паспорт:
${data.tech_passport}

🔹 Телефон: ${data.phone}`
    );

    ctx.editMessageText(
        ctx.update.callback_query.message.text.replace(
            "НЕ ВЫПОЛНЯЕТСЯ 🔴",
            `ВЫПОЛНЯЕТСЯ 🟡\n\nКем: @${ctx.from.username || ctx.from.first_name}`
        ),
        Markup.inlineKeyboard([[Markup.button.callback("Завершить регистрацию", `complete_${userId}`)]])
    );

    ctx.answerCbQuery("Вы начали регистрацию.");
});

bot.action(/complete_(\d+)/, async (ctx) => {
    const userId = ctx.match[1];
    const adminId = ctx.from.id;

    if (activeRegistrations[userId] !== adminId) {
        return ctx.answerCbQuery("Вы не можете завершить регистрацию, начатую другим администратором.");
    }

    ctx.editMessageText(ctx.update.callback_query.message.text.replace("ВЫПОЛНЯЕТСЯ 🟡", "ВЫПОЛНЕНО 🟢"));

    await ctx.telegram.sendMessage(
        userId,
        "Ваша регистрация завершена! Вот инструкции для начала работы: [ссылки и инструкции]."
    );

    delete activeRegistrations[userId];
    ctx.answerCbQuery("Регистрация завершена.");
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`http://localhost:${PORT}`);
});

process.once("SIGINT", () => bot.stop("SIGINT"));
process.once("SIGTERM", () => bot.stop("SIGTERM"));
