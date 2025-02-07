const express = require('express');
const { Telegraf, Markup } = require("telegraf");
require("dotenv").config();

const app = express();
const bot = new Telegraf(process.env.BOT_TOKEN);
const adminGroupId = process.env.ADMIN_GROUP_ID; // ID группы с администраторами


// Health check route
app.get('/', (req, res) => {
    res.send('Bot is running!');
});

// Set webhook URL
const setWebhook = async () => {
    const webhookUrl = `${process.env.SERVER_URL}/bot${process.env.BOT_TOKEN}`;
    try {
        const webhookInfo = await bot.telegram.getWebhookInfo();
        
        if (webhookInfo.url !== webhookUrl) {
            await bot.telegram.setWebhook(webhookUrl);
            console.log(`Webhook set to: ${webhookUrl}`);
        } else {
            console.log(`Webhook already set to: ${webhookUrl}`);
        }
    } catch (error) {
        console.error("Error setting webhook:", error);
    }
};
// Вызов setWebhook можно оставить для первого раза или убрать после успешной установки
setWebhook();

app.use(express.json());
app.use(bot.webhookCallback(`/bot${process.env.BOT_TOKEN}`));


const userSessions = {};
const photoSessions = {};
const activeRegistrations = {}; // Хранит активные регистрации и админов

bot.start((ctx) => {
    ctx.reply("Добро пожаловать! Для регистрации отправьте фото паспорта (спереди).");
    userSessions[ctx.from.id] = { step: "passport_front", data: {} };
});

bot.on("photo", (ctx) => {
    const session = userSessions[ctx.from.id];

    if (!session) {
        return ctx.reply("Пожалуйста, начните регистрацию с команды /start.");
    }

    const fileId = ctx.message.photo.pop().file_id; // Получаем ID файла фотографии

    switch (session.step) {
        case "passport_front":
            session.data.passport_front = fileId;
            session.step = "passport_back";
            ctx.reply("Отправьте фото паспорта (сзади).");
            break;
        case "passport_back":
            session.data.passport_back = fileId;
            session.step = "license_front";
            ctx.reply("Отправьте фото водительского удостоверения (спереди).");
            break;
        case "license_front":
            session.data.license_front = fileId;
            session.step = "license_back";
            ctx.reply("Отправьте фото водительского удостоверения (сзади).");
            break;
        case "license_back":
            session.data.license_back = fileId;
            session.step = "tech_passport_front";
            ctx.reply("Отправьте фото тех. паспорта (спереди).");
            break;
        case "tech_passport_front":
            session.data.tech_passport_front = fileId;
            session.step = "tech_passport_back";
            ctx.reply("Отправьте фото тех. паспорта (сзади).");
            break;
        case "tech_passport_back":
            session.data.tech_passport_back = fileId;
            session.step = "phone";
            ctx.reply(
                "Пожалуйста, отправьте ваш рабочий номер телефона.",
                Markup.keyboard([Markup.button.contactRequest("Отправить номер телефона")])
                    .oneTime()
                    .resize()
            );
            break;
        default:
            ctx.reply("Ожидается номер телефона.");
    }
});

bot.on("contact", (ctx) => {
    const session = userSessions[ctx.from.id];

    if (!session || session.step !== "phone") {
        return ctx.reply("Пожалуйста, отправьте номер телефона после загрузки всех документов.");
    }

    session.data.phone = ctx.message.contact.phone_number;
    sendToAdminGroup(ctx, session.data);
    delete userSessions[ctx.from.id];
    ctx.reply("Ваши данные отправлены на проверку. Ожидайте ответа.", {
        reply_markup: {
            remove_keyboard: true,
        },
    });
});

async function sendToAdminGroup(ctx, data) {
    const messageText = `Новая заявка на регистрацию:`;

    await ctx.telegram.sendMessage(adminGroupId, messageText);

    const photos = await ctx.telegram.sendMediaGroup(adminGroupId, [
        { type: "photo", media: data.passport_front },
        { type: "photo", media: data.passport_back },
        { type: "photo", media: data.license_front },
        { type: "photo", media: data.license_back },
        { type: "photo", media: data.tech_passport_front },
        { type: "photo", media: data.tech_passport_back },
    ]);
    photoSessions[ctx.from.id] = photos.map(item => item.message_id); // Сохраняем ID сообщений с фотографиями
    console.log("🚀 ~ sendToAdminGroup ~ photoSessions:", photoSessions)

    userSessions[ctx.from.id] = data;

    ctx.telegram.sendMessage(
        adminGroupId,
        `Телефон: ${data.phone[0] === "+" ? "": "+"}${data.phone}\n\nСтатус: НЕ ВЫПОЛНЯЕТСЯ 🔴`,
        Markup.inlineKeyboard([
            [Markup.button.callback("Начать регистрацию", `start_${ctx.from.id}_${photos.message_id}`)],
            // [Markup.button.callback("Выполнено", `complete_${ctx.from.id}`)],
        ])
    );
}

bot.action(/start_(\d+)/, async (ctx) => {
    const userId = ctx.match[1];
    const adminId = ctx.from.id; // ID администратора, который нажал кнопку
    console.log("🚀 ~ bot.action ~ ctx.from:", ctx.from)
    const session = userSessions[userId];
    const photosIdArr = photoSessions[userId];

    if (activeRegistrations[userId]) {
        return ctx.answerCbQuery("Регистрация уже выполняется другим администратором.");
    }

    activeRegistrations[userId] = adminId;

    // Удаление сообщений с фотографиями из группы
    try {
        // await ctx.telegram.deleteMessage(adminGroupId, messageId); // Удаление сообщения по ID
        for (const photoId of photosIdArr) {
            await ctx.telegram.deleteMessage(adminGroupId, photoId);
        }
    } catch (error) {
        console.error("Ошибка при удалении сообщения:", error);
    }
    // Пересылка медиа админу в личку
    ctx.telegram.sendMediaGroup(adminId, [
        { type: "photo", media: session.passport_front },
        { type: "photo", media: session.passport_back },
        { type: "photo", media: session.license_front },
        { type: "photo", media: session.license_back },
        { type: "photo", media: session.tech_passport_front },
        { type: "photo", media: session.tech_passport_back },
    ]);

    ctx.editMessageText(ctx.update.callback_query.message.text.replace("НЕ ВЫПОЛНЯЕТСЯ 🔴", `ВЫПОЛНЯЕТСЯ 🟡\n\nКем: @${ctx.from.username || ctx.from.first_name}`));

    // Логируем клавиатуру для проверки
    const keyboard = {
        reply_markup: {
            inline_keyboard: [[{ text: "Завершить регистрацию", callback_data: `complete_${userId}` }]],
        },
    };

    // ctx.editMessageReplyMarkup(keyboard);
    ctx.telegram.editMessageReplyMarkup(
        ctx.chat.id,
        ctx.update.callback_query.message.message_id,
        null,
        keyboard.reply_markup
    ); // Исправленный метод для редактирования клавиатуры

    ctx.answerCbQuery("Вы начали регистрацию."); // Отправьте сообщение администратору, который начал регистрацию
});

bot.action(/complete_(\d+)/, async (ctx) => {
    const userId = ctx.match[1];
    const adminId = ctx.from.id;

    // Проверка, что регистрацию завершает тот же админ
    if (activeRegistrations[userId] !== adminId) {
        return ctx.answerCbQuery("Вы не можете завершить регистрацию, начатую другим администратором.");
    }

    ctx.editMessageText(ctx.update.callback_query.message.text.replace("ВЫПОЛНЯЕТСЯ 🟡", "ВЫПОЛНЕНО 🟢"));
    await ctx.telegram.sendMessage(
        userId,
        "Ваша регистрация завершена! Вот инструкции для начала работы: [ссылки и инструкции]."
    );

    delete activeRegistrations[userId]; // Удаление из активных после завершения
    ctx.answerCbQuery("Регистрация завершена.");
});

bot.launch();

// Start the server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`http://localhost:${PORT}`);
});

process.once("SIGINT", () => bot.stop("SIGINT"));
process.once("SIGTERM", () => bot.stop("SIGTERM"));
