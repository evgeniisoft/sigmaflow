var ALLOWED_CONNECTIONS = {
    // ============ ВЫРУЧКА ============
    'PRICE': {
        canInfluence: ['VOLUME', 'REVENUE'],
        canBeInfluencedBy: ['COMPETITION', 'INFLATION', 'GEO_INDEX', 'NDS_RATE'],
        label: 'Цена'
    },
    'VOLUME': {
        canInfluence: ['REVENUE', 'MATERIAL_COST', 'ENERGY_COST', 'LOGISTICS_COST', 'COGS'],
        canBeInfluencedBy: ['PRICE', 'MARKETING_BUDGET', 'COMPETITION', 'CCI', 'HOUSEHOLD_INCOME', 'BUSINESS_ACTIVITY', 'SEASON', 'CAPACITY'],
        label: 'Объём продаж'
    },
    'CLIENTS': {
        canInfluence: ['REVENUE'],
        canBeInfluencedBy: ['MARKETING_BUDGET', 'NEW_CLIENTS', 'REPEAT_SHARE', 'CONVERSION', 'CCI'],
        label: 'Количество клиентов'
    },
    'AVG_CHECK': {
        canInfluence: ['REVENUE'],
        canBeInfluencedBy: ['PRICE', 'HOUSEHOLD_INCOME', 'INFLATION'],
        label: 'Средний чек',
        isFormula: true
    },
    'NEW_CLIENTS': {
        canInfluence: ['CLIENTS', 'REVENUE'],
        canBeInfluencedBy: ['MARKETING_BUDGET', 'CONVERSION', 'LEADS'],
        label: 'Новые клиенты'
    },
    'REPEAT_SHARE': {
        canInfluence: ['CLIENTS', 'REVENUE'],
        canBeInfluencedBy: ['PRODUCTIVITY', 'ENGAGEMENT'],
        label: 'Доля повторных продаж'
    },
    'EXPORT_SHARE': {
        canInfluence: ['REVENUE'],
        canBeInfluencedBy: ['FX_RATE', 'SANCTIONS', 'GEO_INDEX'],
        label: 'Доля экспорта'
    },
    'SEASON': {
        canInfluence: ['VOLUME', 'REVENUE'],
        canBeInfluencedBy: [],
        label: 'Сезонный коэффициент'
    },
    'BUSINESS_ACTIVITY': {
        canInfluence: ['VOLUME', 'CLIENTS', 'REVENUE'],
        canBeInfluencedBy: ['PMI', 'CB_RATE', 'CCI', 'GEO_INDEX'],
        label: 'Деловая активность'
    },

    // ============ ПЕРСОНАЛ ============
    'PROD_HEADCOUNT': {
        canInfluence: ['PROD_PAYROLL', 'PRODUCTIVITY', 'COGS'],
        canBeInfluencedBy: ['ATTRITION', 'CAPACITY', 'VOLUME'],
        label: 'Численность произв. персонала'
    },
    'ADMIN_HEADCOUNT': {
        canInfluence: ['ADMIN_PAYROLL', 'OPEX'],
        canBeInfluencedBy: ['ATTRITION'],
        label: 'Численность АУП'
    },
    'SALES_HEADCOUNT': {
        canInfluence: ['SALES_PAYROLL', 'SELLING_EXP'],
        canBeInfluencedBy: ['ATTRITION'],
        label: 'Численность продавцов'
    },
    'PROD_AVG_SALARY': {
        canInfluence: ['PROD_PAYROLL', 'COGS'],
        canBeInfluencedBy: ['LABOR_INDEX', 'INFLATION', 'SPI'],
        label: 'Средняя ЗП произв.'
    },
    'ADMIN_AVG_SALARY': {
        canInfluence: ['ADMIN_PAYROLL', 'OPEX'],
        canBeInfluencedBy: ['LABOR_INDEX', 'INFLATION', 'SPI'],
        label: 'Средняя ЗП АУП'
    },
    'SALES_AVG_SALARY': {
        canInfluence: ['SALES_PAYROLL', 'SELLING_EXP'],
        canBeInfluencedBy: ['LABOR_INDEX', 'INFLATION'],
        label: 'Средняя ЗП продавцов'
    },
    'PROD_PAYROLL': {
        canInfluence: ['COGS'],
        canBeInfluencedBy: ['PROD_HEADCOUNT', 'PROD_AVG_SALARY', 'BONUS_PROFIT_PCT', 'INSURANCE_RATE'],
        label: 'ФОТ произв.',
        isFormula: true
    },
    'ADMIN_PAYROLL': {
        canInfluence: ['OPEX'],
        canBeInfluencedBy: ['ADMIN_HEADCOUNT', 'ADMIN_AVG_SALARY', 'BONUS_PROFIT_PCT', 'INSURANCE_RATE'],
        label: 'ФОТ АУП',
        isFormula: true
    },
    'SALES_PAYROLL': {
        canInfluence: ['SELLING_EXP'],
        canBeInfluencedBy: ['SALES_HEADCOUNT', 'SALES_AVG_SALARY', 'BONUS_REVENUE_PCT', 'BONUS_PROFIT_PCT'],
        label: 'ФОТ продавцов',
        isFormula: true
    },
    'BONUS_PROFIT_PCT': {
        canInfluence: ['PROD_PAYROLL', 'ADMIN_PAYROLL', 'SALES_PAYROLL', 'COGS', 'OPEX'],
        canBeInfluencedBy: ['NET_PROFIT', 'EBITDA'],
        label: 'Премия (% от прибыли)'
    },
    'BONUS_REVENUE_PCT': {
        canInfluence: ['SALES_PAYROLL', 'SELLING_EXP'],
        canBeInfluencedBy: ['REVENUE'],
        label: 'Премия (% от выручки)'
    },
    'ATTRITION': {
        canInfluence: ['PROD_HEADCOUNT', 'ADMIN_HEADCOUNT', 'SALES_HEADCOUNT', 'TRAINING_COST', 'PRODUCTIVITY'],
        canBeInfluencedBy: ['ENGAGEMENT', 'LABOR_INDEX', 'SPI'],
        label: 'Текучесть'
    },
    'ENGAGEMENT': {
        canInfluence: ['ATTRITION', 'PRODUCTIVITY'],
        canBeInfluencedBy: ['TRAINING_COST', 'SPI'],
        label: 'Вовлечённость'
    },
    'PRODUCTIVITY': {
        canInfluence: ['REVENUE'],
        canBeInfluencedBy: ['PROD_HEADCOUNT', 'ENGAGEMENT', 'TRAINING_COST', 'ATTRITION'],
        label: 'Производительность',
        isFormula: true
    },
    'TRAINING_COST': {
        canInfluence: ['PRODUCTIVITY', 'ENGAGEMENT', 'OPEX'],
        canBeInfluencedBy: ['ATTRITION'],
        label: 'Затраты на обучение'
    },

    // ============ МАРКЕТИНГ ============
    'MARKETING_BUDGET': {
        canInfluence: ['LEADS', 'VOLUME', 'NEW_CLIENTS', 'CLIENTS', 'SELLING_EXP'],
        canBeInfluencedBy: ['NET_PROFIT', 'REVENUE', 'COMPETITION', 'LTV'],
        label: 'Бюджет маркетинга'
    },
    'COST_PER_LEAD': {
        canInfluence: ['MARKETING_BUDGET'],
        canBeInfluencedBy: ['MARKETING_BUDGET', 'LEADS'],
        label: 'Стоимость лида',
        isFormula: true
    },
    'LEADS': {
        canInfluence: ['NEW_CLIENTS'],
        canBeInfluencedBy: ['MARKETING_BUDGET'],
        label: 'Количество лидов'
    },
    'CONVERSION': {
        canInfluence: ['NEW_CLIENTS', 'CLIENTS'],
        canBeInfluencedBy: [],
        label: 'Конверсия в клиента'
    },
    'CAC': {
        canInfluence: ['MARKETING_BUDGET'],
        canBeInfluencedBy: ['MARKETING_BUDGET', 'NEW_CLIENTS'],
        label: 'Стоимость привлечения клиента',
        isFormula: true
    },
    'LTV': {
        canInfluence: ['MARKETING_BUDGET'],
        canBeInfluencedBy: ['REVENUE', 'CLIENTS'],
        label: 'Пожизненная ценность клиента'
    },
    'COMPETITION': {
        canInfluence: ['PRICE', 'VOLUME', 'MARKETING_BUDGET'],
        canBeInfluencedBy: ['GEO_INDEX'],
        label: 'Уровень конкуренции'
    },

    // ============ ПРОИЗВОДСТВО ============
    'MATERIAL_COST': {
        canInfluence: ['COGS'],
        canBeInfluencedBy: ['VOLUME', 'UNIT_MATERIAL', 'DEFECT_RATE', 'SUPPLIER_RISK'],
        label: 'Сырьё и материалы',
        isFormula: true
    },
    'UNIT_MATERIAL': {
        canInfluence: ['MATERIAL_COST', 'COGS'],
        canBeInfluencedBy: ['INFLATION', 'FX_RATE', 'TARIFFS', 'GEO_INDEX', 'SUPPLIER_RISK'],
        label: 'Цена сырья за единицу'
    },
    'ENERGY_COST': {
        canInfluence: ['COGS'],
        canBeInfluencedBy: ['VOLUME', 'TARIFFS'],
        label: 'Энергозатраты'
    },
    'LOGISTICS_COST': {
        canInfluence: ['COGS'],
        canBeInfluencedBy: ['VOLUME', 'TARIFFS', 'FX_RATE'],
        label: 'Логистика'
    },
    'DEFECT_RATE': {
        canInfluence: ['MATERIAL_COST', 'COGS', 'REVENUE'],
        canBeInfluencedBy: ['WEAR', 'PRODUCTIVITY'],
        label: 'Брак (%)'
    },
    'CAPACITY': {
        canInfluence: ['VOLUME'],
        canBeInfluencedBy: ['CAPEX', 'WEAR'],
        label: 'Производственная мощность'
    },
    'CAPACITY_UTIL': {
        canInfluence: ['COGS'],
        canBeInfluencedBy: ['VOLUME', 'CAPACITY'],
        label: 'Загрузка мощностей',
        isFormula: true
    },
    'WEAR': {
        canInfluence: ['DEFECT_RATE', 'DA', 'CAPACITY'],
        canBeInfluencedBy: ['CAPEX', 'CAPACITY_UTIL'],
        label: 'Износ оборудования'
    },
    'SUPPLIER_RISK': {
        canInfluence: ['UNIT_MATERIAL', 'MATERIAL_COST'],
        canBeInfluencedBy: ['GEO_INDEX', 'SANCTIONS'],
        label: 'Риск дефолта поставщика'
    },

    // ============ OPEX ============
    'RENT': { canInfluence: ['OPEX'], canBeInfluencedBy: ['INFLATION'], label: 'Аренда' },
    'IT_EXP': { canInfluence: ['OPEX'], canBeInfluencedBy: ['HEADCOUNT'], label: 'IT-расходы' },
    'RD_EXP': { canInfluence: ['OPEX'], canBeInfluencedBy: ['NET_PROFIT'], label: 'R&D расходы' },
    'LEGAL_COST': { canInfluence: ['OPEX'], canBeInfluencedBy: [], label: 'Юридические расходы' },
    'INSURANCE_COST': { canInfluence: ['OPEX'], canBeInfluencedBy: [], label: 'Страхование' },
    'TRAVEL_COST': { canInfluence: ['OPEX'], canBeInfluencedBy: ['HEADCOUNT'], label: 'Командировочные' },
    'UTILITIES': { canInfluence: ['OPEX'], canBeInfluencedBy: ['TARIFFS', 'INFLATION'], label: 'Коммунальные платежи' },

    // ============ АКТИВЫ ============
    'FIXED_ASSETS': {
        canInfluence: ['DA', 'ASSETS'],
        canBeInfluencedBy: ['CAPEX'],
        label: 'Основные средства'
    },
    'INTANGIBLE_ASSETS': {
        canInfluence: ['DA', 'ASSETS'],
        canBeInfluencedBy: ['CAPEX'],
        label: 'Нематериальные активы'
    },
    'DA': {
        canInfluence: ['EBIT', 'NET_PROFIT', 'CFO'],
        canBeInfluencedBy: ['FIXED_ASSETS', 'INTANGIBLE_ASSETS', 'DA_RATE'],
        label: 'Амортизация',
        isFormula: true
    },
    'DA_RATE': {
        canInfluence: ['DA'],
        canBeInfluencedBy: ['WEAR'],
        label: 'Норма амортизации'
    },
    'CAPEX': {
        canInfluence: ['FIXED_ASSETS', 'INTANGIBLE_ASSETS', 'CASH', 'WEAR'],
        canBeInfluencedBy: ['NET_PROFIT', 'LOANS'],
        label: 'Капитальные затраты'
    },
    'INVENTORY': {
        canInfluence: ['CASH', 'COGS'],
        canBeInfluencedBy: ['VOLUME'],
        label: 'Товарные запасы'
    },
    'RECEIVABLES': {
        canInfluence: ['CASH', 'CFO'],
        canBeInfluencedBy: ['REVENUE'],
        label: 'Дебиторская задолженность'
    },
    'PAYABLES': {
        canInfluence: ['CASH', 'CFO'],
        canBeInfluencedBy: ['MATERIAL_COST', 'COGS'],
        label: 'Кредиторская задолженность'
    },
    'CASH': {
        canInfluence: ['CFO'],
        canBeInfluencedBy: ['CASH_START', 'FCF', 'CAPEX', 'NEW_LOANS', 'LOAN_REPAYMENT', 'RECEIVABLES', 'PAYABLES', 'INVENTORY'],
        label: 'Денежные средства',
        isFormula: true
    },
    'CASH_START': {
        canInfluence: ['CASH'],
        canBeInfluencedBy: [],
        label: 'Остаток на начало'
    },

    // ============ ДОЛГ ============
    'LOANS': {
        canInfluence: ['INTEREST', 'CASH', 'DEBT_EBITDA'],
        canBeInfluencedBy: ['NEW_LOANS', 'LOAN_REPAYMENT'],
        label: 'Кредитный портфель'
    },
    'NEW_LOANS': {
        canInfluence: ['LOANS', 'CASH', 'CFF'],
        canBeInfluencedBy: ['CREDIT_RATING'],
        label: 'Новые кредиты'
    },
    'LOAN_REPAYMENT': {
        canInfluence: ['LOANS', 'CASH', 'CFF'],
        canBeInfluencedBy: [],
        label: 'Погашение тела'
    },
    'LOAN_RATE': {
        canInfluence: ['INTEREST'],
        canBeInfluencedBy: ['CB_RATE', 'BANK_SPREAD', 'CREDIT_RATING'],
        label: 'Средняя ставка',
        isFormula: true
    },
    'BANK_SPREAD': {
        canInfluence: ['LOAN_RATE'],
        canBeInfluencedBy: ['CREDIT_RATING'],
        label: 'Спред банка'
    },
    'INTEREST': {
        canInfluence: ['EBT', 'NET_PROFIT'],
        canBeInfluencedBy: ['LOANS', 'LOAN_RATE'],
        label: 'Проценты к уплате',
        isFormula: true
    },
    'INTEREST_INCOME': {
        canInfluence: ['EBT', 'NET_PROFIT'],
        canBeInfluencedBy: [],
        label: 'Проценты к получению'
    },
    'DIVIDENDS': {
        canInfluence: ['CASH', 'RETAINED_EARNINGS', 'CFF'],
        canBeInfluencedBy: ['NET_PROFIT'],
        label: 'Дивиденды'
    },
    'CREDIT_RATING': {
        canInfluence: ['BANK_SPREAD', 'LOAN_RATE', 'NEW_LOANS'],
        canBeInfluencedBy: ['DEBT_EBITDA', 'NET_PROFIT'],
        label: 'Кредитный рейтинг'
    },

    // ============ ВНЕШНИЕ ============
    'CB_RATE': { canInfluence: ['LOAN_RATE', 'BUSINESS_ACTIVITY'], canBeInfluencedBy: [], label: 'Ключевая ставка ЦБ' },
    'INFLATION': { canInfluence: ['UNIT_MATERIAL', 'AVG_SALARY', 'PRICE', 'RENT'], canBeInfluencedBy: [], label: 'Инфляция' },
    'FX_RATE': { canInfluence: ['UNIT_MATERIAL', 'EXPORT_SHARE', 'REVENUE'], canBeInfluencedBy: ['GEO_INDEX', 'SANCTIONS'], label: 'Курс USD/RUB' },
    'PMI': { canInfluence: ['BUSINESS_ACTIVITY', 'VOLUME'], canBeInfluencedBy: [], label: 'Индекс PMI' },
    'CCI': { canInfluence: ['VOLUME', 'CLIENTS', 'BUSINESS_ACTIVITY'], canBeInfluencedBy: [], label: 'Потребительская уверенность' },
    'HOUSEHOLD_INCOME': { canInfluence: ['AVG_CHECK', 'VOLUME'], canBeInfluencedBy: [], label: 'Доходы населения' },
    'LABOR_INDEX': { canInfluence: ['AVG_SALARY', 'ATTRITION'], canBeInfluencedBy: [], label: 'Индекс рынка труда' },
    'GEO_INDEX': { canInfluence: ['SUPPLIER_RISK', 'FX_RATE', 'SANCTIONS', 'BUSINESS_ACTIVITY'], canBeInfluencedBy: [], label: 'Геополитический индекс' },
    'SANCTIONS': { canInfluence: ['EXPORT_SHARE', 'UNIT_MATERIAL', 'FX_RATE'], canBeInfluencedBy: ['GEO_INDEX'], label: 'Санкционный индекс' },
    'TARIFFS': { canInfluence: ['ENERGY_COST', 'LOGISTICS_COST', 'UTILITIES', 'UNIT_MATERIAL'], canBeInfluencedBy: [], label: 'Тарифы монополий' },

    // ============ НАЛОГИ ============
    'TAX_RATE': { canInfluence: ['TAX', 'NET_PROFIT'], canBeInfluencedBy: [], label: 'Ставка налога на прибыль' },
    'NDS_RATE': { canInfluence: ['PRICE'], canBeInfluencedBy: [], label: 'Ставка НДС' },
    'INSURANCE_RATE': { canInfluence: ['PROD_PAYROLL', 'ADMIN_PAYROLL'], canBeInfluencedBy: [], label: 'Ставка страховых взносов' },
    'PROPERTY_TAX_RATE': { canInfluence: ['OPEX'], canBeInfluencedBy: [], label: 'Налог на имущество' },
    'TRADE_FEE': { canInfluence: ['OPEX'], canBeInfluencedBy: [], label: 'Торговый сбор' },
    'PENALTIES': { canInfluence: ['EBT', 'CASH'], canBeInfluencedBy: [], label: 'Штрафы и пени' }
};
