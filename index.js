const express = require("express");
const { Telegraf, Markup } = require("telegraf");
const mongoose = require("mongoose");
require("dotenv").config();

const app = express();
const bot = new Telegraf(process.env.BOT_TOKEN);
const adminGroupId = process.env.ADMIN_GROUP_ID;

// Health check route
app.get("/", (req, res) => {
    res.send("Bot is running!");
});

// MongoDB Connection
mongoose.connect(process.env.MONGODB_URI).then(() => {
    console.log("MongoDB connected");
});

// MongoDB Schemas
const DriverSchema = new mongoose.Schema({
    telegramId: String,
    username: String,
    language: String,
    passport: {
        fullName: String,
        serialNumber: String,
        birthDate: String,
    },
    driverLicense: {
        series: String,
        number: String,
        issueDate: String,
        categories: String,
    },
    techPassport: {
        series: String,
        number: String,
        year: String,
        model: String,
    },
    phone: String,
    invitedBy: { type: String, default: null },
    registrationStatus: { type: String, default: "pending" },
});

const Driver = mongoose.model("Driver", DriverSchema);

// Available languages with expanded UI text elements
const LANGUAGES = {
    ru: {
        name: "Русский",
        // Main menu texts
        MAIN_MENU: {
            TITLE: "Главное меню",
            REGISTER_BUTTON: "📝 Регистрация",
            INVITE_BUTTON: "👥 Пригласить друга",
            MY_INVITES_BUTTON: "📋 Мои приглашения",
            CHANGE_LANG_BUTTON: "🌐 Изменить язык",
            HELP_BUTTON: "❓ Помощь",
            BACK_BUTTON: "⬅️ Назад",
        },
        // Registration steps texts
        REGISTRATION_STEPS: {
            PASSPORT: {
                fullName: "Введите ФИО:",
                serialNumber: "Введите серийный номер паспорта:",
                birthDate: "Введите дату рождения (DD.MM.YYYY):",
            },
            LICENSE: {
                series: "Введите серию водительского удостоверения:",
                number: "Введите номер водительского удостоверения:",
                issueDate: "Введите дату выдачи (DD.MM.YYYY):",
                categories: "Введите категории:",
            },
            TECH_PASSPORT: {
                series: "Введите серию тех. паспорта:",
                number: "Введите номер тех. паспорта:",
                year: "Введите год выпуска:",
                model: "Введите марку и модель:",
            },
            PHONE: "Отправьте ваш рабочий номер телефона",
        },
        // Status and notification messages
        MESSAGES: {
            WELCOME: "Выберите действие:",
            LANG_CHANGED: "Язык изменен на Русский",
            REGISTRATION_COMPLETE: "Ваши данные отправлены на проверку. Ожидайте ответа.",
            REGISTRATION_APPROVED: "Ваша регистрация завершена! Теперь вы можете приглашать других водителей и использовать все функции бота.",
            INVITE_INTRO: "Вы можете пригласить друга стать водителем. Укажите его данные:",
            NO_INVITES: "У вас пока нет приглашённых водителей.",
            INVITES_LIST_INTRO: "Приглашённые вами водители:",
            HELP_TEXT: "Этот бот помогает зарегистрироваться в качестве водителя. Используйте меню для навигации.\n\nКоманды:\n/start - Открыть главное меню\n/help - Показать справку",
            NOT_REGISTERED: "Вы должны быть зарегистрированным водителем для использования этой функции.",
            INVALID_PHONE: "Пожалуйста, введите корректный номер телефона.",
            ERROR_OCCURRED: "Произошла ошибка. Пожалуйста, попробуйте позже.",
            REGISTRATION_STARTED: "Начинаем процесс регистрации. Следуйте инструкциям.",
        },
    },
    uz: {
        name: "O'zbek",
        // Main menu texts
        MAIN_MENU: {
            TITLE: "Asosiy menyu",
            REGISTER_BUTTON: "📝 Ro'yxatdan o'tish",
            INVITE_BUTTON: "👥 Do'stingizni taklif qiling",
            MY_INVITES_BUTTON: "📋 Mening takliflarim",
            CHANGE_LANG_BUTTON: "🌐 Tilni o'zgartirish",
            HELP_BUTTON: "❓ Yordam",
            BACK_BUTTON: "⬅️ Orqaga",
        },
        // Registration steps texts
        REGISTRATION_STEPS: {
            PASSPORT: {
                fullName: "FISh ni kiriting:",
                serialNumber: "Passport seriya raqamini kiriting:",
                birthDate: "Tug'ilgan sanangizni kiriting (KK.OO.YYYY):",
            },
            LICENSE: {
                series: "Haydovchilik guvohnomasining seriyasini kiriting:",
                number: "Haydovchilik guvohnomasining raqamini kiriting:",
                issueDate: "Berilgan sanani kiriting (KK.OO.YYYY):",
                categories: "Toifalarni kiriting:",
            },
            TECH_PASSPORT: {
                series: "Texnik passport seriyasini kiriting:",
                number: "Texnik passport raqamini kiriting:",
                year: "Ishlab chiqarilgan yilini kiriting:",
                model: "Rusumi va modelini kiriting:",
            },
            PHONE: "Ish telefon raqamingizni yuboring",
        },
        // Status and notification messages
        MESSAGES: {
            WELCOME: "Amalni tanlang:",
            LANG_CHANGED: "Til O'zbek tiliga o'zgartirildi",
            REGISTRATION_COMPLETE: "Ma'lumotlaringiz tekshirish uchun yuborildi. Javobni kuting.",
            REGISTRATION_APPROVED: "Ro'yxatdan o'tishingiz yakunlandi! Endi siz boshqa haydovchilarni taklif qilishingiz va botning barcha funksiyalaridan foydalanishingiz mumkin.",
            INVITE_INTRO: "Siz do'stingizni haydovchi bo'lishga taklif qilishingiz mumkin. Uning ma'lumotlarini kiriting:",
            NO_INVITES: "Sizda hali taklif qilingan haydovchilar yo'q.",
            INVITES_LIST_INTRO: "Siz taklif qilgan haydovchilar:",
            HELP_TEXT: "Ushbu bot haydovchi sifatida ro'yxatdan o'tishga yordam beradi. Navigatsiya uchun menyudan foydalaning.\n\nBuyruqlar:\n/start - Asosiy menyuni ochish\n/help - Yo'riqnomani ko'rsatish",
            NOT_REGISTERED: "Bu funksiyadan foydalanish uchun ro'yxatdan o'tgan haydovchi bo'lishingiz kerak.",
            INVALID_PHONE: "Iltimos, to'g'ri telefon raqamini kiriting.",
            ERROR_OCCURRED: "Xatolik yuz berdi. Iltimos, keyinroq qayta urinib ko'ring.",
            REGISTRATION_STARTED: "Ro'yxatdan o'tish jarayonini boshlaymiz. Ko'rsatmalarga amal qiling.",
        },
    },
};

const userSessions = {};

// Helper function to get user's language texts
const getLangText = (userId) => LANGUAGES[userSessions[userId]?.language || "ru"];

// Helper function to create main menu keyboard based on user status
const getMainMenuKeyboard = async (userId, language) => {
    const texts = LANGUAGES[language].MAIN_MENU;
    const isRegistered = await isUserRegistered(userId);
    console.log("🚀 ~ getMainMenuKeyboard ~ isRegistered:", isRegistered)
    
    const keyboard = [];
    
    // Different options based on registration status
    if (!isRegistered) {
        keyboard.push([Markup.button.callback(texts.REGISTER_BUTTON, "start_registration")]);
    } else {
        keyboard.push([Markup.button.callback(texts.INVITE_BUTTON, "invite_friend")]);
        keyboard.push([Markup.button.callback(texts.MY_INVITES_BUTTON, "my_invites")]);
    }
    
    // These options are always available
    keyboard.push([Markup.button.callback(texts.CHANGE_LANG_BUTTON, "change_language")]);
    keyboard.push([Markup.button.callback(texts.HELP_BUTTON, "show_help")]);
    
    return Markup.inlineKeyboard(keyboard);
};

// Check if user is registered and approved
async function isUserRegistered(userId) {
    if (!userId) return false;
    const driver = await Driver.findOne({ 
        telegramId: userId.toString(),
        registrationStatus: "approved" 
    });
    console.log(driver)
    return driver ? true : false;
}

// Start command handler - Entry point for the bot
bot.command("start", async (ctx) => {
    if (ctx.chat.type !== "private") return; // Ignore group/channel messages
    
    // Check if user has a language preference saved
    const userId = ctx.from.id;
    const existingDriver = await Driver.findOne({ telegramId: userId.toString() });
    
    if (existingDriver && existingDriver.language) {
        // User exists with language preference
        userSessions[userId] = {
            language: existingDriver.language
        };
        
        const texts = getLangText(userId);
        const mainMenuKeyboard = await getMainMenuKeyboard(userId, existingDriver.language);
        
        ctx.reply(texts.MESSAGES.WELCOME, mainMenuKeyboard);
    } else {
        // New user or language not set - show language selection
        const keyboard = Markup.inlineKeyboard([
            [Markup.button.callback("🇷🇺 Русский", "lang_ru"), Markup.button.callback("🇺🇿 O'zbek", "lang_uz")],
        ]);
        
        ctx.reply("Выберите язык / Tilni tanlang:", keyboard);
    }
});

// Help command handler
bot.command("help", (ctx) => {
    if (ctx.chat.type !== "private") return;
    
    const userId = ctx.from.id;
    const texts = getLangText(userId);
    
    ctx.reply(texts.MESSAGES.HELP_TEXT);
});

// Language selection handler
bot.action(/lang_(ru|uz)/, async (ctx) => {
    if (ctx.chat.type !== "private") return;
    
    const lang = ctx.match[1];
    const userId = ctx.from.id;
    
    // Save language preference
    userSessions[userId] = {
        language: lang
    };
    
    // Update language in database if user exists
    const existingDriver = await Driver.findOne({ telegramId: userId.toString() });
    if (existingDriver) {
        existingDriver.language = lang;
        await existingDriver.save();
    }
    
    const texts = getLangText(userId);
    const mainMenuKeyboard = await getMainMenuKeyboard(userId, lang);
    
    // Confirm language change and show main menu
    await ctx.answerCbQuery(texts.MESSAGES.LANG_CHANGED);
    await ctx.reply(texts.MESSAGES.WELCOME, mainMenuKeyboard);
});

// Show language change menu
bot.action("change_language", async (ctx) => {
    const keyboard = Markup.inlineKeyboard([
        [Markup.button.callback("🇷🇺 Русский", "lang_ru"), Markup.button.callback("🇺🇿 O'zbek", "lang_uz")],
        [Markup.button.callback("⬅️ Back / Orqaga", "back_to_main")]
    ]);
    
    await ctx.editMessageText("Выберите язык / Tilni tanlang:", keyboard);
});

// Start registration process from menu
bot.action("start_registration", async (ctx) => {
    const userId = ctx.from.id;
    const texts = getLangText(userId);
    
    userSessions[userId] = {
        ...userSessions[userId],
        step: "PASSPORT",
        currentField: "fullName",
        data: {},
    };
    
    await ctx.answerCbQuery();
    await ctx.reply(texts.MESSAGES.REGISTRATION_STARTED);
    await ctx.reply(texts.REGISTRATION_STEPS.PASSPORT.fullName);
});

// Invite friend action
bot.action("invite_friend", async (ctx) => {
    const userId = ctx.from.id;
    const texts = getLangText(userId);
    
    const isRegistered = await isUserRegistered(userId);
    if (!isRegistered) {
        await ctx.answerCbQuery(texts.MESSAGES.NOT_REGISTERED);
        return;
    }
    
    userSessions[userId] = {
        ...userSessions[userId],
        isInviting: true,
        step: "PASSPORT",
        currentField: "fullName",
        data: {},
    };
    
    await ctx.answerCbQuery();
    await ctx.reply(texts.MESSAGES.INVITE_INTRO);
    await ctx.reply(texts.REGISTRATION_STEPS.PASSPORT.fullName);
});

// My invites action
bot.action("my_invites", async (ctx) => {
    const userId = ctx.from.id;
    const texts = getLangText(userId);
    
    const isRegistered = await isUserRegistered(userId);
    if (!isRegistered) {
        await ctx.answerCbQuery(texts.MESSAGES.NOT_REGISTERED);
        return;
    }
    
    const invitedDrivers = await Driver.find({ invitedBy: userId.toString() });
    
    if (invitedDrivers.length === 0) {
        await ctx.answerCbQuery();
        await ctx.reply(texts.MESSAGES.NO_INVITES);
        return;
    }
    
    const message = invitedDrivers
        .map((driver, index) => {
            const status = {
                pending: "⏳ Ожидает проверки",
                in_progress: "🔍 В процессе регистрации",
                approved: "✅ Завершен"
            }[driver.registrationStatus] || "⏳ Ожидает проверки";
            
            return `${index + 1}. ${driver.passport?.fullName || "Неизвестно"} - ${status}`;
        })
        .join("\n");
    
    await ctx.answerCbQuery();
    await ctx.reply(`${texts.MESSAGES.INVITES_LIST_INTRO}\n\n${message}`);
});

// Show help from menu
bot.action("show_help", async (ctx) => {
    const userId = ctx.from.id;
    const texts = getLangText(userId);
    
    await ctx.answerCbQuery();
    await ctx.reply(texts.MESSAGES.HELP_TEXT);
});

// Back to main menu button handler
bot.action("back_to_main", async (ctx) => {
    const userId = ctx.from.id;
    const texts = getLangText(userId);
    const mainMenuKeyboard = await getMainMenuKeyboard(userId, userSessions[userId]?.language || "ru");
    
    await ctx.answerCbQuery();
    await ctx.editMessageText(texts.MESSAGES.WELCOME, mainMenuKeyboard);
});

// Handle text messages for registration flow
bot.on("text", async (ctx) => {
    if (ctx.chat.type !== "private") return;
    
    const userId = ctx.from.id;
    const session = userSessions[userId];
    
    if (!session || !session.data) {
        // No active session, show help message
        await ctx.reply("Используйте /start для начала работы с ботом.");
        return;
    }
    
    const texts = getLangText(userId);
    
    // Handle phone number input separately
    if (session.step === "PHONE") {
        const phoneRegex = /^\+?\d[\d\s-()]{8,}$/;
        if (!phoneRegex.test(ctx.message.text)) {
            return ctx.reply(texts.MESSAGES.INVALID_PHONE);
        }
        session.data.phone = ctx.message.text;
        
        try {
            const driver = await createDriver(ctx, session);
            ctx.reply(texts.MESSAGES.REGISTRATION_COMPLETE, Markup.removeKeyboard());
            delete userSessions[userId];
            
            // Show main menu after registration completion
            const mainMenuKeyboard = await getMainMenuKeyboard(userId, session.language);
            await ctx.reply(texts.MESSAGES.WELCOME, mainMenuKeyboard);
        } catch (error) {
            console.error("Error creating driver:", error);
            ctx.reply(texts.MESSAGES.ERROR_OCCURRED);
        }
        return;
    }
    
    // Update current field data 
    
    if (!session.data[session.step]) {
        session.data[session.step] = {};
    }
    
    session.data[session.step][session.currentField] = ctx.message.text;
    
    // Determine next field/step
    const steps = ["PASSPORT", "LICENSE", "TECH_PASSPORT", "PHONE"];
    const fields = {
        PASSPORT: ["fullName", "serialNumber", "birthDate"],
        LICENSE: ["series", "number", "issueDate", "categories"],
        TECH_PASSPORT: ["series", "number", "year", "model"],
        PHONE: [],
    };
    
    if (fields[session.step]) {
        const currentFieldIndex = fields[session.step].indexOf(session.currentField);
        if (currentFieldIndex < fields[session.step].length - 1) {
            // Move to next field in current step
            session.currentField = fields[session.step][currentFieldIndex + 1];
            ctx.reply(texts.REGISTRATION_STEPS[session.step][session.currentField]);
        } else {
            // Move to next step
            const currentStepIndex = steps.indexOf(session.step);
            if (currentStepIndex < steps.length - 1) {
                session.step = steps[currentStepIndex + 1];
                if (session.step === "PHONE") {
                    if (!session.isInviting) {
                        ctx.reply(
                            texts.REGISTRATION_STEPS.PHONE,
                            Markup.keyboard([[Markup.button.contactRequest("📞 Отправить контакт")]])
                                .oneTime()
                                .resize()
                        );    
                    } else {
                        ctx.reply(texts.REGISTRATION_STEPS.PHONE);
                    }
                } else {
                    session.currentField = fields[session.step][0];
                    ctx.reply(texts.REGISTRATION_STEPS[session.step][session.currentField]);
                }
            }
        }
    }
});

// Handle contact sharing
bot.on("contact", async (ctx) => {
    const userId = ctx.from.id;
    const session = userSessions[userId];
    
    if (!session || session.step !== "PHONE") {
        return ctx.reply("Пожалуйста, следуйте инструкциям.");
    }
    
    const texts = getLangText(userId);
    
    session.data.phone = ctx.message.contact.phone_number;
    
    try {
        await createDriver(ctx, session);
        ctx.reply(texts.MESSAGES.REGISTRATION_COMPLETE, Markup.removeKeyboard());
        delete userSessions[userId];
        
        // Show main menu after registration completion
        const mainMenuKeyboard = await getMainMenuKeyboard(userId, session.language);
        await ctx.reply(texts.MESSAGES.WELCOME, mainMenuKeyboard);
    } catch (error) {
        console.error("Error creating driver:", error);
        ctx.reply(texts.MESSAGES.ERROR_OCCURRED);
    }
});

// Create driver record in database
async function createDriver(ctx, session) {
    try {
        const userId = ctx.from.id;
        
        const driverData = {
            telegramId: session.isInviting ? null : userId.toString(),
            username: ctx.from.username,
            language: session.language,
            passport: session.data.PASSPORT,
            driverLicense: session.data.LICENSE,
            techPassport: session.data.TECH_PASSPORT,
            phone: session.data.phone,
            invitedBy: session.isInviting ? userId.toString() : null,
        };
        
        const driver = new Driver(driverData);
        await driver.save();
        
        // Create detailed message for admins with formatted data
        const messageText = `
📱 *Новая заявка на регистрацию*
От: @${driver.username}
${session.isInviting ? "\n👤 Приглашён водителем: @" + ctx.from.username : ""}

📋 *Паспорт*:
ФИО: \`${driver.passport.fullName}\`
Серия и номер: \`${driver.passport.serialNumber}\`
Дата рождения: \`${driver.passport.birthDate}\`

🚗 *Водительское удостоверение*:
Серия: \`${driver.driverLicense.series}\`
Номер: \`${driver.driverLicense.number}\`
Дата выдачи: \`${driver.driverLicense.issueDate}\`
Категории: \`${driver.driverLicense.categories}\`

📚 *Тех. паспорт*:
Серия: \`${driver.techPassport.series}\`
Номер: \`${driver.techPassport.number}\`
Год выпуска: \`${driver.techPassport.year}\`
Марка и модель: \`${driver.techPassport.model}\`

📞 Телефон: \`${driver.phone}\`

*Статус*: НЕ ВЫПОЛНЯЕТСЯ 🔴`;
        
        // Send formatted message to admin group with action buttons
        await ctx.telegram.sendMessage(
            adminGroupId,
            messageText,
            {
                parse_mode: "Markdown",
                reply_markup: Markup.inlineKeyboard([
                    [Markup.button.callback("✅ Начать регистрацию", `start_${driver._id}`)],
                    [Markup.button.callback("❌ Отклонить", `reject_${driver._id}`)]
                ]).reply_markup
            }
        );
        
        return driver;
    } catch (error) {
        console.error("Error in createDriver:", error);
        throw error;
    }
}

// Admin starts checking
bot.action(/start_(.+)/, async (ctx) => {
    const driverId = ctx.match[1];
    const adminId = ctx.from.id;
    const adminUsername = ctx.from.username || ctx.from.first_name;
    
    const driver = await Driver.findById(driverId);
    if (!driver) return ctx.answerCbQuery("Водитель не найден.");
    
    if (driver.registrationStatus === "in_progress") {
        return ctx.answerCbQuery("Регистрация уже выполняется другим администратором.");
    }
    
    driver.registrationStatus = "in_progress";
    await driver.save();
    
    // Send data separately to admin's private chat with better formatting
    await ctx.telegram.sendMessage(
        adminId,
        `*🔹 Паспортные данные*\nФИО: \`${driver.passport.fullName}\`\nСерия и номер: \`${driver.passport.serialNumber}\`\nДата рождения: \`${driver.passport.birthDate}\``,
        { parse_mode: "Markdown" }
    );
    
    await ctx.telegram.sendMessage(
        adminId,
        `*🔹 Водительское удостоверение*\nСерия: \`${driver.driverLicense.series}\`\nНомер: \`${driver.driverLicense.number}\`\nДата выдачи: \`${driver.driverLicense.issueDate}\`\nКатегории: \`${driver.driverLicense.categories}\``,
        { parse_mode: "Markdown" }
    );
    
    await ctx.telegram.sendMessage(
        adminId,
        `*🔹 Технический паспорт*\nСерия: \`${driver.techPassport.series}\`\nНомер: \`${driver.techPassport.number}\`\nГод выпуска: \`${driver.techPassport.year}\`\nМарка и модель: \`${driver.techPassport.model}\``,
        { parse_mode: "Markdown" }
    );
    
    await ctx.telegram.sendMessage(
        adminId, 
        `*🔹 Телефон*: \`${driver.phone}\``,
        { parse_mode: "Markdown" }
    );
    
    // Update admin group message with status change
    const updatedText = ctx.update.callback_query.message.text.replace(
        "НЕ ВЫПОЛНЯЕТСЯ 🔴",
        `ВЫПОЛНЯЕТСЯ 🟡\n\nКем: @${adminUsername}`
    );
    
    // Update with better admin action buttons
    ctx.editMessageText(
        updatedText,
        {
            parse_mode: "Markdown",
            reply_markup: Markup.inlineKeyboard([
                [Markup.button.callback("✅ Одобрить", `complete_${driverId}`)],
                [Markup.button.callback("❌ Отклонить", `reject_${driverId}`)]
            ]).reply_markup
        }
    );
    
    ctx.answerCbQuery("Вы начали регистрацию. Информация отправлена вам в личные сообщения.");
});

// Complete registration (approve driver)
bot.action(/complete_(.+)/, async (ctx) => {
    const driverId = ctx.match[1];
    const driver = await Driver.findById(driverId);
    
    if (!driver) return ctx.answerCbQuery("Водитель не найден");
    if (driver.registrationStatus !== "in_progress") {
        return ctx.answerCbQuery("Невозможно завершить процесс регистрации.");
    }
    
    driver.registrationStatus = "approved";
    await driver.save();
    
    // Update admin group message with approval status
    ctx.editMessageText(
        ctx.update.callback_query.message.text.replace("ВЫПОЛНЯЕТСЯ 🟡", "ВЫПОЛНЕНО ✅"),
        { parse_mode: "Markdown" }
    );
    
    // Notify the driver about approval with instructions
    if (driver.telegramId) {
        // Get language for this user
        const lang = driver.language || "ru";
        const texts = LANGUAGES[lang];
        
        // Create welcome message with instructions
        const welcomeMessage = `
🎉 *${texts.MESSAGES.REGISTRATION_APPROVED}*

Что вы можете делать:
- Приглашать новых водителей
- Отслеживать статус ваших приглашений
- И многое другое!

Используйте команду /start для доступа к главному меню.
`;
        
        await ctx.telegram.sendMessage(
            driver.telegramId,
            welcomeMessage,
            { 
                parse_mode: "Markdown",
                reply_markup: Markup.inlineKeyboard([[
                    Markup.button.callback("🚀 Открыть меню", "back_to_main")
                ]]).reply_markup
            }
        );
    }
    
    ctx.answerCbQuery("Регистрация успешно завершена");
});

// Reject registration
bot.action(/reject_(.+)/, async (ctx) => {
    const driverId = ctx.match[1];
    const driver = await Driver.findById(driverId);
    
    if (!driver) return ctx.answerCbQuery("Водитель не найден");
    
    // Update status to rejected
    driver.registrationStatus = "rejected";
    await driver.save();
    
    // Update admin group message with rejection status
    ctx.editMessageText(
        ctx.update.callback_query.message.text.replace(
            /НЕ ВЫПОЛНЯЕТСЯ 🔴|ВЫПОЛНЯЕТСЯ 🟡/,
            "ОТКЛОНЕНО ❌"
        ),
        { parse_mode: "Markdown" }
    );
    
    // Notify the driver about rejection
    if (driver.telegramId) {
        const lang = driver.language || "ru";
        const rejectMessage = lang === "ru" 
            ? "К сожалению, ваша заявка на регистрацию была отклонена. Пожалуйста, свяжитесь с администратором для получения дополнительной информации."
            : "Afsuski, ro'yxatdan o'tish arizangiz rad etildi. Qo'shimcha ma'lumot olish uchun administrator bilan bog'laning.";
            
        await ctx.telegram.sendMessage(driver.telegramId, rejectMessage);
    }
    
    ctx.answerCbQuery("Заявка отклонена");
});

// Setup webhook and start server
const setWebhook = async () => {
    const webhookUrl = `${
        process.env.NODE_ENV === "production" ? process.env.SERVER_URL : process.env.NGROK_SERVER_URL
    }/bot${process.env.BOT_TOKEN}`;
    try {
        await bot.telegram.deleteWebhook().then(console.log("webhook deleted"));
        await bot.telegram.setWebhook(webhookUrl);
        console.log(`Webhook set to: ${webhookUrl}`);
    } catch (error) {
        console.error("Error setting webhook:", error);
    }
};

app.use(express.json());
app.use(bot.webhookCallback(`/bot${process.env.BOT_TOKEN}`));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    setWebhook();
});

process.once("SIGINT", () => bot.stop("SIGINT"));
process.once("SIGTERM", () => bot.stop("SIGTERM"));