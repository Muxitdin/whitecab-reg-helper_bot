const { Telegraf, Markup } = require("telegraf");
require("dotenv").config();

const bot = new Telegraf(process.env.BOT_TOKEN);
const adminGroupId = process.env.ADMIN_GROUP_ID; // ID группы с администраторами

const userSessions = {};
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

    await ctx.telegram.sendMediaGroup(adminGroupId, [
        { type: "photo", media: data.passport_front },
        { type: "photo", media: data.passport_back },
        { type: "photo", media: data.license_front },
        { type: "photo", media: data.license_back },
        { type: "photo", media: data.tech_passport_front },
        { type: "photo", media: data.tech_passport_back },
    ]);

    ctx.telegram.sendMessage(
        adminGroupId,
        `Телефон: +${data.phone}\n\nСтатус: НЕ ВЫПОЛНЯЕТСЯ`,
        Markup.inlineKeyboard([
            [Markup.button.callback("Начать регистрацию", `start_${ctx.from.id}`)],
            // [Markup.button.callback("Выполнено", `complete_${ctx.from.id}`)],
        ])
    );
}

bot.action(/start_(\d+)/, (ctx) => {
    const userId = ctx.match[1];
    const adminId = ctx.from.id; // ID администратора, который нажал кнопку

    if (activeRegistrations[userId]) {
        return ctx.answerCbQuery("Регистрация уже выполняется другим администратором.");
    }

    activeRegistrations[userId] = adminId;
    ctx.editMessageText(ctx.update.callback_query.message.text.replace("НЕ ВЫПОЛНЯЕТСЯ", "ВЫПОЛНЯЕТСЯ"));
    // ctx.editMessageReplyMarkup(Markup.inlineKeyboard([
    //     [Markup.button.callback("Завершить регистрацию", `complete_${userId}`)]
    // ]));

    // Логируем клавиатуру для проверки
    const keyboard = {
        reply_markup: {
            inline_keyboard: [
                [{ text: "Завершить регистрацию", callback_data: `complete_${userId}` }]
            ]
        }
    };

    console.log(keyboard);

    // ctx.editMessageReplyMarkup(keyboard);
    ctx.telegram.editMessageReplyMarkup(ctx.chat.id, ctx.update.callback_query.message.message_id, null, keyboard.reply_markup); // Исправленный метод для редактирования клавиатуры

    ctx.answerCbQuery("Вы начали регистрацию."); // Отправьте сообщение администратору, который начал регистрацию
});

bot.action(/complete_(\d+)/, async (ctx) => {
    const userId = ctx.match[1];
    const adminId = ctx.from.id;

    // Проверка, что регистрацию завершает тот же админ
    if (activeRegistrations[userId] !== adminId) {
        return ctx.answerCbQuery("Вы не можете завершить регистрацию, начатую другим администратором.");
    }

    ctx.editMessageText(ctx.update.callback_query.message.text.replace("ВЫПОЛНЯЕТСЯ", "ВЫПОЛНЕНО"));
    await ctx.telegram.sendMessage(
        userId,
        "Ваша регистрация завершена! Вот инструкции для начала работы: [ссылки и инструкции]."
    );

    delete activeRegistrations[userId]; // Удаление из активных после завершения
    // ctx.editMessageReplyMarkup();
    ctx.answerCbQuery("Регистрация завершена.");
});

bot.launch();

process.once("SIGINT", () => bot.stop("SIGINT"));
process.once("SIGTERM", () => bot.stop("SIGTERM"));
