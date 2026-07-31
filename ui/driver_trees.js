var DRIVER_TREES = {

    // ============================================================
    // ПРОИЗВОДСТВО
    // ============================================================
    production: {
        root: 'NET_PROFIT',
        label: 'Производство',
        nodes: {
            'NET_PROFIT': {
                label: 'Чистая прибыль',
                type: 'result',
                children: ['REVENUE', 'TOTAL_COSTS'],
                signs: { 'REVENUE': 1, 'TOTAL_COSTS': -1 }
            },
            'REVENUE': {
                label: 'Выручка',
                type: 'computed',
                children: ['VOLUME', 'PRICE'],
                formula: 'VOLUME * PRICE',
                drivers: ['VOLUME', 'PRICE']
            },
            'VOLUME': {
                label: 'Объём продаж (ед/мес)',
                type: 'driver',
                nodeId: 'VOLUME',
                min: 0, max: 1000, step: 10,
                unit: 'ед',
                affects: ['REVENUE', 'MATERIAL_COST', 'PROD_HEADCOUNT'],
                nonlinear: {
                    'PROD_HEADCOUNT': {
                        type: 'step',
                        formula: 'ceil(VOLUME / PROD_CAPACITY_PER_WORKER)',
                        description: '1 рабочий производит {PROD_CAPACITY_PER_WORKER} ед/мес. При росте объёма автоматически нанимаем персонал.',
                        paramNode: 'PROD_CAPACITY_PER_WORKER'
                    }
                }
            },
            'PRICE': {
                label: 'Цена за единицу',
                type: 'driver',
                nodeId: 'PRICE',
                min: 100, max: 50000, step: 100,
                unit: '₽',
                affects: ['REVENUE', 'VOLUME'],
                nonlinear: {
                    'VOLUME': {
                        type: 'elasticity',
                        formula: 'VOLUME_base * (PRICE / PRICE_base)^elasticity',
                        elasticityNode: 'PRICE_ELASTICITY',
                        defaultValue: -0.8,
                        description: 'При росте цены на 10% объём падает на 8%'
                    }
                }
            },
            'PROD_CAPACITY_PER_WORKER': {
                label: 'Выработка на 1 рабочего',
                type: 'hidden',
                nodeId: 'PROD_CAPACITY_PER_WORKER',
                defaultValue: 15,
                unit: 'ед/мес'
            },
            'PRICE_ELASTICITY': {
                label: 'Эластичность спроса',
                type: 'hidden',
                nodeId: 'PRICE_ELASTICITY',
                defaultValue: -0.8
            },
            'TOTAL_COSTS': {
                label: 'Общие расходы',
                type: 'computed',
                children: ['COGS', 'OPEX', 'INTEREST', 'TAX'],
                signs: { 'COGS': 1, 'OPEX': 1, 'INTEREST': 1, 'TAX': 1 }
            },
            'COGS': {
                label: 'Себестоимость',
                type: 'computed',
                children: ['MATERIAL_COST', 'DIRECT_LABOR', 'ENERGY_COST', 'LOGISTICS_COST', 'DEFECT_COST']
            },
            'MATERIAL_COST': {
                label: 'Сырьё',
                type: 'computed',
                children: ['VOLUME', 'UNIT_MATERIAL'],
                formula: 'VOLUME * UNIT_MATERIAL',
                drivers: ['UNIT_MATERIAL']
            },
            'UNIT_MATERIAL': {
                label: 'Цена сырья за ед.',
                type: 'driver',
                nodeId: 'UNIT_MATERIAL',
                min: 0, max: 50000, step: 100,
                unit: '₽/ед'
            },
            'DIRECT_LABOR': {
                label: 'ФОТ произв. персонала',
                type: 'computed',
                children: ['PROD_HEADCOUNT', 'PROD_AVG_SALARY'],
                formula: 'PROD_HEADCOUNT * PROD_AVG_SALARY',
                drivers: ['PROD_HEADCOUNT', 'PROD_AVG_SALARY']
            },
            'PROD_HEADCOUNT': {
                label: 'Производственный персонал',
                type: 'driver',
                nodeId: 'PROD_HEADCOUNT',
                min: 1, max: 500, step: 1,
                unit: 'чел',
                affects: ['DIRECT_LABOR', 'VOLUME'],
                nonlinear: {
                    'VOLUME': {
                        type: 'capacity',
                        formula: 'PROD_HEADCOUNT * PROD_CAPACITY_PER_WORKER',
                        description: 'Максимальный объём = персонал × выработка',
                        paramNode: 'PROD_CAPACITY_PER_WORKER'
                    }
                }
            },
            'PROD_AVG_SALARY': {
                label: 'Средняя ЗП произв.',
                type: 'driver',
                nodeId: 'PROD_AVG_SALARY',
                min: 20000, max: 300000, step: 5000,
                unit: '₽/мес'
            },
            'ENERGY_COST': {
                label: 'Энергозатраты',
                type: 'driver',
                nodeId: 'ENERGY_COST',
                min: 0, max: 2000000, step: 5000,
                unit: '₽/мес',
                affects: ['COGS']
            },
            'LOGISTICS_COST': {
                label: 'Логистика',
                type: 'driver',
                nodeId: 'LOGISTICS_COST',
                min: 0, max: 1000000, step: 5000,
                unit: '₽/мес',
                affects: ['COGS']
            },
            'DEFECT_COST': {
                label: 'Потери от брака',
                type: 'computed',
                children: ['MATERIAL_COST', 'DEFECT_RATE'],
                formula: 'MATERIAL_COST * DEFECT_RATE / 100',
                drivers: ['DEFECT_RATE']
            },
            'DEFECT_RATE': {
                label: 'Брак (%)',
                type: 'driver',
                nodeId: 'DEFECT_RATE',
                min: 0, max: 30, step: 0.5,
                unit: '%'
            },
            'OPEX': {
                label: 'Операционные расходы',
                type: 'computed',
                children: ['ADMIN_PAYROLL', 'RENT', 'MARKETING', 'IT_EXP', 'OTHER_OPEX']
            },
            'ADMIN_PAYROLL': {
                label: 'ФОТ АУП',
                type: 'computed',
                children: ['ADMIN_HEADCOUNT', 'ADMIN_AVG_SALARY'],
                formula: 'ADMIN_HEADCOUNT * ADMIN_AVG_SALARY',
                drivers: ['ADMIN_HEADCOUNT', 'ADMIN_AVG_SALARY']
            },
            'ADMIN_HEADCOUNT': {
                label: 'Административный персонал',
                type: 'driver',
                nodeId: 'ADMIN_HEADCOUNT',
                min: 0, max: 50, step: 1,
                unit: 'чел'
            },
            'ADMIN_AVG_SALARY': {
                label: 'Средняя ЗП АУП',
                type: 'driver',
                nodeId: 'ADMIN_AVG_SALARY',
                min: 30000, max: 500000, step: 10000,
                unit: '₽/мес'
            },
            'RENT': {
                label: 'Аренда',
                type: 'driver',
                nodeId: 'RENT',
                min: 0, max: 2000000, step: 10000,
                unit: '₽/мес'
            },
            'MARKETING': {
                label: 'Маркетинг',
                type: 'driver',
                nodeId: 'MARKETING',
                min: 0, max: 10000000, step: 10000,
                unit: '₽/мес',
                affects: ['VOLUME'],
                nonlinear: {
                    'VOLUME': {
                        type: 'diminishing_returns',
                        formula: 'VOLUME_base + a * MARKETING^b',
                        params: { a: 0.8, b: 0.5 },
                        lag: 2,
                        description: 'Удвоение бюджета → рост продаж в 1.4 раза. Эффект через 2 месяца.'
                    }
                }
            },
            'IT_EXP': {
                label: 'IT-расходы',
                type: 'driver',
                nodeId: 'IT_EXP',
                min: 0, max: 1000000, step: 5000,
                unit: '₽/мес'
            },
            'OTHER_OPEX': {
                label: 'Прочие операционные',
                type: 'computed',
                children: ['TRAINING_COST', 'LEGAL_COST', 'BANK_FEES', 'INSURANCE_COST', 'UTILITIES', 'OFFICE_EXP', 'TRAVEL_COST', 'RD_EXP', 'OUTSOURCE_COST']
            },
            'INTEREST': {
                label: 'Проценты',
                type: 'driver',
                nodeId: 'INTEREST',
                min: 0, max: 0, step: 0,
                unit: '₽/мес',
                computed: true
            },
            'TAX': {
                label: 'Налог на прибыль',
                type: 'driver',
                nodeId: 'TAX',
                min: 0, max: 0, step: 0,
                unit: '₽/мес',
                computed: true
            }
        }
    },

    // ============================================================
    // IT / РАЗРАБОТКА ПО
    // ============================================================
    it: {
        root: 'NET_PROFIT',
        label: 'IT / Разработка ПО',
        nodes: {
            'NET_PROFIT': {
                label: 'Чистая прибыль',
                type: 'result',
                children: ['REVENUE', 'TOTAL_COSTS'],
                signs: { 'REVENUE': 1, 'TOTAL_COSTS': -1 }
            },
            'REVENUE': {
                label: 'Выручка',
                type: 'computed',
                children: ['MONTHLY_RATE_PER_DEV', 'DEV_HEADCOUNT', 'UTILIZATION'],
                formula: 'MONTHLY_RATE_PER_DEV * DEV_HEADCOUNT * UTILIZATION / 100',
                drivers: ['MONTHLY_RATE_PER_DEV', 'DEV_HEADCOUNT', 'UTILIZATION']
            },
            'MONTHLY_RATE_PER_DEV': {
                label: 'Ставка за разработчика',
                type: 'driver',
                nodeId: 'MONTHLY_RATE_PER_DEV',
                min: 50000, max: 1000000, step: 10000,
                unit: '₽/мес',
                affects: ['REVENUE'],
                nonlinear: {
                    'REVENUE': {
                        type: 'elasticity',
                        formula: 'UTILIZATION = UTILIZATION_base * (RATE / RATE_base)^elasticity',
                        elasticityNode: 'RATE_ELASTICITY',
                        defaultValue: -0.5,
                        description: 'При росте ставки на 10% утилизация падает на 5% (часть клиентов уходит)'
                    }
                }
            },
            'RATE_ELASTICITY': {
                label: 'Эластичность по ставке',
                type: 'hidden',
                nodeId: 'RATE_ELASTICITY',
                defaultValue: -0.5
            },
            'DEV_HEADCOUNT': {
                label: 'Разработчики',
                type: 'driver',
                nodeId: 'DEV_HEADCOUNT',
                min: 1, max: 500, step: 1,
                unit: 'чел',
                affects: ['REVENUE', 'DEV_PAYROLL', 'UTILIZATION'],
                nonlinear: {
                    'UTILIZATION': {
                        type: 'ramp_up',
                        formula: 'UTILIZATION_base * (1 - RAMP_UP_LOSS * NEW_DEV_PCT)',
                        params: { rampUpLoss: 0.15, rampUpMonths: 2 },
                        description: 'Новые разработчики выходят на полную утилизацию через 2 месяца. В первый месяц утилизация падает на 15%.'
                    }
                }
            },
            'UTILIZATION': {
                label: 'Утилизация (%)',
                type: 'driver',
                nodeId: 'UTILIZATION',
                min: 30, max: 100, step: 5,
                unit: '%',
                affects: ['REVENUE', 'DEV_PAYROLL'],
                nonlinear: {
                    'DEV_PAYROLL': {
                        type: 'overtime',
                        formula: 'DEV_PAYROLL_base * (1 + max(0, UTILIZATION - OVERTIME_THRESHOLD) * OVERTIME_RATE / 100)',
                        paramNodes: { threshold: 'OVERTIME_THRESHOLD', rate: 'OVERTIME_RATE' },
                        defaultThreshold: 85,
                        defaultRate: 0.5,
                        description: 'При утилизации >85% включаются сверхурочные. Каждый % выше 85% = +0.5% к ФОТ.'
                    }
                }
            },
            'OVERTIME_THRESHOLD': {
                label: 'Порог утилизации без переработок',
                type: 'hidden',
                nodeId: 'OVERTIME_THRESHOLD',
                defaultValue: 85,
                unit: '%'
            },
            'OVERTIME_RATE': {
                label: 'Коэффициент сверхурочных',
                type: 'hidden',
                nodeId: 'OVERTIME_RATE',
                defaultValue: 0.5
            },
            'DEV_PAYROLL': {
                label: 'ФОТ разработчиков',
                type: 'computed',
                children: ['DEV_HEADCOUNT', 'DEV_AVG_SALARY'],
                formula: 'DEV_HEADCOUNT * DEV_AVG_SALARY',
                drivers: ['DEV_AVG_SALARY']
            },
            'DEV_AVG_SALARY': {
                label: 'Средняя ЗП разработчика',
                type: 'driver',
                nodeId: 'DEV_AVG_SALARY',
                min: 50000, max: 500000, step: 10000,
                unit: '₽/мес'
            },
            'TOTAL_COSTS': {
                label: 'Общие расходы',
                type: 'computed',
                children: ['DEV_PAYROLL', 'ADMIN_PAYROLL', 'RENT', 'MARKETING', 'IT_EXP', 'OTHER_OPEX', 'INTEREST', 'TAX']
            },
            'ADMIN_PAYROLL': {
                label: 'ФОТ АУП',
                type: 'computed',
                children: ['ADMIN_HEADCOUNT', 'ADMIN_AVG_SALARY'],
                formula: 'ADMIN_HEADCOUNT * ADMIN_AVG_SALARY',
                drivers: ['ADMIN_HEADCOUNT', 'ADMIN_AVG_SALARY']
            },
            'ADMIN_HEADCOUNT': {
                label: 'Административный персонал',
                type: 'driver',
                nodeId: 'ADMIN_HEADCOUNT',
                min: 0, max: 30, step: 1,
                unit: 'чел'
            },
            'ADMIN_AVG_SALARY': {
                label: 'Средняя ЗП АУП',
                type: 'driver',
                nodeId: 'ADMIN_AVG_SALARY',
                min: 30000, max: 300000, step: 10000,
                unit: '₽/мес'
            },
            'RENT': {
                label: 'Аренда',
                type: 'driver',
                nodeId: 'RENT',
                min: 0, max: 1000000, step: 10000,
                unit: '₽/мес'
            },
            'MARKETING': {
                label: 'Маркетинг',
                type: 'driver',
                nodeId: 'MARKETING',
                min: 0, max: 5000000, step: 10000,
                unit: '₽/мес',
                affects: ['DEV_HEADCOUNT'],
                nonlinear: {
                    'DEV_HEADCOUNT': {
                        type: 'diminishing_returns',
                        formula: 'DEV_HEADCOUNT_base + a * MARKETING^b',
                        params: { a: 0.02, b: 0.4 },
                        lag: 2,
                        description: 'Маркетинг приводит лидов. Рост числа разработчиков = новые проекты.'
                    }
                }
            },
            'IT_EXP': {
                label: 'IT-расходы',
                type: 'driver',
                nodeId: 'IT_EXP',
                min: 0, max: 2000000, step: 10000,
                unit: '₽/мес'
            },
            'OTHER_OPEX': {
                label: 'Прочие операционные',
                type: 'computed',
                children: ['TRAINING_COST', 'LEGAL_COST', 'BANK_FEES', 'INSURANCE_COST', 'UTILITIES', 'OFFICE_EXP', 'TRAVEL_COST', 'RD_EXP', 'OUTSOURCE_COST']
            },
            'INTEREST': {
                label: 'Проценты',
                type: 'driver',
                nodeId: 'INTEREST',
                computed: true
            },
            'TAX': {
                label: 'Налог на прибыль',
                type: 'driver',
                nodeId: 'TAX',
                computed: true
            }
        }
    },

    // ============================================================
    // УСЛУГИ / СЕРВИС
    // ============================================================
    services: {
        root: 'NET_PROFIT',
        label: 'Услуги / Сервис',
        nodes: {
            'NET_PROFIT': {
                label: 'Чистая прибыль',
                type: 'result',
                children: ['REVENUE', 'TOTAL_COSTS'],
                signs: { 'REVENUE': 1, 'TOTAL_COSTS': -1 }
            },
            'REVENUE': {
                label: 'Выручка',
                type: 'computed',
                children: ['HOURLY_REVENUE', 'CHECK_REVENUE'],
                formula: 'HOURLY_REVENUE + CHECK_REVENUE',
                drivers: []
            },
            'HOURLY_REVENUE': {
                label: 'Выручка от часов',
                type: 'computed',
                children: ['HOURLY_RATE', 'HOURS_SOLD'],
                formula: 'HOURLY_RATE * HOURS_SOLD',
                drivers: ['HOURLY_RATE', 'HOURS_SOLD']
            },
            'HOURLY_RATE': {
                label: 'Ставка часа',
                type: 'driver',
                nodeId: 'HOURLY_RATE',
                min: 500, max: 20000, step: 500,
                unit: '₽/час'
            },
            'HOURS_SOLD': {
                label: 'Оплаченные часы',
                type: 'driver',
                nodeId: 'HOURS_SOLD',
                min: 0, max: 5000, step: 50,
                unit: 'часов/мес',
                affects: ['SPECIALIST_HEADCOUNT'],
                nonlinear: {
                    'SPECIALIST_HEADCOUNT': {
                        type: 'capacity',
                        formula: 'ceil(HOURS_SOLD / HOURS_PER_SPECIALIST)',
                        paramNode: 'HOURS_PER_SPECIALIST',
                        defaultValue: 160,
                        description: '1 специалист = 160 часов/мес. При росте часов автоматически нанимаем.'
                    }
                }
            },
            'HOURS_PER_SPECIALIST': {
                label: 'Часов на специалиста',
                type: 'hidden',
                nodeId: 'HOURS_PER_SPECIALIST',
                defaultValue: 160
            },
            'CHECK_REVENUE': {
                label: 'Выручка от чеков',
                type: 'computed',
                children: ['AVG_CHECK', 'CLIENTS'],
                formula: 'AVG_CHECK * CLIENTS',
                drivers: ['AVG_CHECK', 'CLIENTS']
            },
            'AVG_CHECK': {
                label: 'Средний чек',
                type: 'driver',
                nodeId: 'AVG_CHECK',
                min: 500, max: 100000, step: 1000,
                unit: '₽'
            },
            'CLIENTS': {
                label: 'Количество клиентов',
                type: 'driver',
                nodeId: 'CLIENTS',
                min: 0, max: 5000, step: 10,
                unit: 'чел/мес'
            },
            'SPECIALIST_PAYROLL': {
                label: 'ФОТ специалистов',
                type: 'computed',
                children: ['SPECIALIST_HEADCOUNT', 'SPECIALIST_AVG_SALARY'],
                formula: 'SPECIALIST_HEADCOUNT * SPECIALIST_AVG_SALARY',
                drivers: ['SPECIALIST_HEADCOUNT', 'SPECIALIST_AVG_SALARY']
            },
            'SPECIALIST_HEADCOUNT': {
                label: 'Специалисты',
                type: 'driver',
                nodeId: 'SPECIALIST_HEADCOUNT',
                min: 1, max: 200, step: 1,
                unit: 'чел',
                affects: ['HOURS_SOLD'],
                nonlinear: {
                    'HOURS_SOLD': {
                        type: 'capacity',
                        formula: 'SPECIALIST_HEADCOUNT * HOURS_PER_SPECIALIST',
                        description: 'Максимальные часы = специалисты × 160 ч/мес'
                    }
                }
            },
            'SPECIALIST_AVG_SALARY': {
                label: 'Средняя ЗП специалиста',
                type: 'driver',
                nodeId: 'SPECIALIST_AVG_SALARY',
                min: 30000, max: 250000, step: 10000,
                unit: '₽/мес'
            },
            'TOTAL_COSTS': {
                label: 'Общие расходы',
                type: 'computed',
                children: ['SPECIALIST_PAYROLL', 'ADMIN_PAYROLL', 'RENT', 'MARKETING', 'IT_EXP', 'OTHER_OPEX', 'INTEREST', 'TAX']
            },
            'ADMIN_PAYROLL': {
                label: 'ФОТ АУП',
                type: 'computed',
                children: ['ADMIN_HEADCOUNT', 'ADMIN_AVG_SALARY'],
                formula: 'ADMIN_HEADCOUNT * ADMIN_AVG_SALARY',
                drivers: ['ADMIN_HEADCOUNT', 'ADMIN_AVG_SALARY']
            },
            'ADMIN_HEADCOUNT': {
                label: 'Административный персонал',
                type: 'driver',
                nodeId: 'ADMIN_HEADCOUNT',
                min: 0, max: 30, step: 1,
                unit: 'чел'
            },
            'ADMIN_AVG_SALARY': {
                label: 'Средняя ЗП АУП',
                type: 'driver',
                nodeId: 'ADMIN_AVG_SALARY',
                min: 30000, max: 300000, step: 10000,
                unit: '₽/мес'
            },
            'RENT': {
                label: 'Аренда',
                type: 'driver',
                nodeId: 'RENT',
                min: 0, max: 1000000, step: 10000,
                unit: '₽/мес'
            },
            'MARKETING': {
                label: 'Маркетинг',
                type: 'driver',
                nodeId: 'MARKETING',
                min: 0, max: 5000000, step: 10000,
                unit: '₽/мес',
                affects: ['CLIENTS'],
                nonlinear: {
                    'CLIENTS': {
                        type: 'diminishing_returns',
                        formula: 'CLIENTS_base + a * MARKETING^b',
                        params: { a: 0.1, b: 0.5 },
                        lag: 2,
                        description: 'Удвоение бюджета → рост клиентов в 1.4 раза. Эффект через 2 месяца.'
                    }
                }
            },
            'IT_EXP': {
                label: 'IT-расходы',
                type: 'driver',
                nodeId: 'IT_EXP',
                min: 0, max: 1000000, step: 5000,
                unit: '₽/мес'
            },
            'OTHER_OPEX': {
                label: 'Прочие операционные',
                type: 'computed',
                children: ['TRAINING_COST', 'LEGAL_COST', 'BANK_FEES', 'INSURANCE_COST', 'UTILITIES', 'OFFICE_EXP', 'TRAVEL_COST', 'RD_EXP', 'OUTSOURCE_COST']
            },
            'INTEREST': {
                label: 'Проценты',
                type: 'driver',
                nodeId: 'INTEREST',
                computed: true
            },
            'TAX': {
                label: 'Налог на прибыль',
                type: 'driver',
                nodeId: 'TAX',
                computed: true
            }
        }
    },

    // ============================================================
    // ТОРГОВЛЯ / РОЗНИЦА
    // ============================================================
    retail: {
        root: 'NET_PROFIT',
        label: 'Торговля / Розница',
        nodes: {
            'NET_PROFIT': {
                label: 'Чистая прибыль',
                type: 'result',
                children: ['GROSS_MARGIN', 'OPEX', 'INTEREST', 'TAX'],
                signs: { 'GROSS_MARGIN': 1, 'OPEX': -1, 'INTEREST': -1, 'TAX': -1 }
            },
            'GROSS_MARGIN': {
                label: 'Маржинальная прибыль',
                type: 'computed',
                children: ['REVENUE', 'COGS'],
                formula: 'REVENUE - COGS',
                drivers: []
            },
            'REVENUE': {
                label: 'Выручка',
                type: 'computed',
                children: ['VOLUME', 'PRICE'],
                formula: 'VOLUME * PRICE',
                drivers: ['VOLUME', 'PRICE']
            },
            'VOLUME': {
                label: 'Объём продаж (ед/мес)',
                type: 'driver',
                nodeId: 'VOLUME',
                min: 0, max: 10000, step: 50,
                unit: 'ед',
                affects: ['REVENUE', 'UNIT_PURCHASE', 'WAREHOUSE_STAFF'],
                nonlinear: {
                    'UNIT_PURCHASE': {
                        type: 'scale_discount',
                        formula: 'UNIT_PURCHASE_base * (1 - max(0, VOLUME - DISCOUNT_THRESHOLD) * DISCOUNT_RATE / 1000)',
                        paramNodes: { threshold: 'DISCOUNT_THRESHOLD', rate: 'DISCOUNT_RATE' },
                        defaultThreshold: 500,
                        defaultRate: 0.5,
                        description: 'При объёме >500 ед/мес — скидка 0.5% от закупочной цены за каждые 1000 ед.'
                    },
                    'WAREHOUSE_STAFF': {
                        type: 'step',
                        formula: 'max(WAREHOUSE_STAFF_base, ceil(VOLUME / UNITS_PER_WAREHOUSE_WORKER))',
                        paramNodes: { unitsPerWorker: 'UNITS_PER_WAREHOUSE_WORKER' },
                        defaultUnitsPerWorker: 500,
                        description: '1 сотрудник склада обрабатывает 500 ед/мес. При росте объёма нужны дополнительные люди.'
                    }
                }
            },
            'UNITS_PER_WAREHOUSE_WORKER': {
                label: 'Единиц на 1 сотрудника склада',
                type: 'hidden',
                nodeId: 'UNITS_PER_WAREHOUSE_WORKER',
                defaultValue: 500
            },
            'DISCOUNT_THRESHOLD': {
                label: 'Порог объёма для скидки',
                type: 'hidden',
                nodeId: 'DISCOUNT_THRESHOLD',
                defaultValue: 500
            },
            'DISCOUNT_RATE': {
                label: 'Процент скидки за объём',
                type: 'hidden',
                nodeId: 'DISCOUNT_RATE',
                defaultValue: 0.5
            },
            'PRICE': {
                label: 'Цена за единицу',
                type: 'driver',
                nodeId: 'PRICE',
                min: 100, max: 100000, step: 500,
                unit: '₽',
                affects: ['REVENUE', 'VOLUME'],
                nonlinear: {
                    'VOLUME': {
                        type: 'elasticity',
                        formula: 'VOLUME_base * (PRICE / PRICE_base)^elasticity',
                        elasticityNode: 'PRICE_ELASTICITY',
                        defaultValue: -1.2,
                        description: 'В рознице эластичность выше. При росте цены на 10% объём падает на 12%.'
                    }
                }
            },
            'PRICE_ELASTICITY': {
                label: 'Эластичность спроса',
                type: 'hidden',
                nodeId: 'PRICE_ELASTICITY',
                defaultValue: -1.2
            },
            'COGS': {
                label: 'Себестоимость продаж',
                type: 'computed',
                children: ['PURCHASE_COST', 'WAREHOUSE_PAYROLL', 'LOGISTICS_COST', 'RETURN_COST'],
                drivers: []
            },
            'PURCHASE_COST': {
                label: 'Закупка товара',
                type: 'computed',
                children: ['VOLUME', 'UNIT_PURCHASE'],
                formula: 'VOLUME * UNIT_PURCHASE',
                drivers: ['UNIT_PURCHASE']
            },
            'UNIT_PURCHASE': {
                label: 'Закупочная цена',
                type: 'driver',
                nodeId: 'UNIT_PURCHASE',
                min: 50, max: 50000, step: 100,
                unit: '₽/ед'
            },
            'WAREHOUSE_PAYROLL': {
                label: 'ФОТ склада',
                type: 'computed',
                children: ['WAREHOUSE_STAFF', 'WAREHOUSE_AVG_SALARY'],
                formula: 'WAREHOUSE_STAFF * WAREHOUSE_AVG_SALARY',
                drivers: ['WAREHOUSE_STAFF', 'WAREHOUSE_AVG_SALARY']
            },
            'WAREHOUSE_STAFF': {
                label: 'Персонал склада',
                type: 'driver',
                nodeId: 'WAREHOUSE_STAFF',
                min: 0, max: 100, step: 1,
                unit: 'чел'
            },
            'WAREHOUSE_AVG_SALARY': {
                label: 'Средняя ЗП склада',
                type: 'driver',
                nodeId: 'WAREHOUSE_AVG_SALARY',
                min: 20000, max: 150000, step: 5000,
                unit: '₽/мес'
            },
            'LOGISTICS_COST': {
                label: 'Логистика',
                type: 'driver',
                nodeId: 'LOGISTICS_COST',
                min: 0, max: 2000000, step: 10000,
                unit: '₽/мес'
            },
            'RETURN_COST': {
                label: 'Потери от возвратов',
                type: 'computed',
                children: ['REVENUE', 'RETURN_RATE'],
                formula: 'REVENUE * RETURN_RATE / 100',
                drivers: ['RETURN_RATE']
            },
            'RETURN_RATE': {
                label: 'Процент возвратов',
                type: 'driver',
                nodeId: 'RETURN_RATE',
                min: 0, max: 20, step: 0.5,
                unit: '%'
            },
            'OPEX': {
                label: 'Операционные расходы',
                type: 'computed',
                children: ['SALES_PAYROLL', 'ADMIN_PAYROLL', 'RENT', 'MARKETING', 'IT_EXP', 'OTHER_OPEX'],
                drivers: []
            },
            'SALES_PAYROLL': {
                label: 'ФОТ продавцов',
                type: 'computed',
                children: ['SALES_HEADCOUNT', 'SALES_AVG_SALARY'],
                formula: 'SALES_HEADCOUNT * SALES_AVG_SALARY',
                drivers: ['SALES_HEADCOUNT', 'SALES_AVG_SALARY']
            },
            'SALES_HEADCOUNT': {
                label: 'Продавцы',
                type: 'driver',
                nodeId: 'SALES_HEADCOUNT',
                min: 1, max: 200, step: 1,
                unit: 'чел',
                affects: ['VOLUME'],
                nonlinear: {
                    'VOLUME': {
                        type: 'capacity',
                        formula: 'SALES_HEADCOUNT * UNITS_PER_SALESPERSON',
                        paramNodes: { unitsPerPerson: 'UNITS_PER_SALESPERSON' },
                        defaultUnitsPerPerson: 100,
                        description: '1 продавец обслуживает 100 ед/мес. Больше продавцов = больше потенциал продаж.'
                    }
                }
            },
            'UNITS_PER_SALESPERSON': {
                label: 'Единиц на 1 продавца',
                type: 'hidden',
                nodeId: 'UNITS_PER_SALESPERSON',
                defaultValue: 100
            },
            'SALES_AVG_SALARY': {
                label: 'Средняя ЗП продавца',
                type: 'driver',
                nodeId: 'SALES_AVG_SALARY',
                min: 25000, max: 200000, step: 5000,
                unit: '₽/мес'
            },
            'ADMIN_PAYROLL': {
                label: 'ФОТ АУП',
                type: 'computed',
                children: ['ADMIN_HEADCOUNT', 'ADMIN_AVG_SALARY'],
                formula: 'ADMIN_HEADCOUNT * ADMIN_AVG_SALARY',
                drivers: ['ADMIN_HEADCOUNT', 'ADMIN_AVG_SALARY']
            },
            'ADMIN_HEADCOUNT': {
                label: 'Административный персонал',
                type: 'driver',
                nodeId: 'ADMIN_HEADCOUNT',
                min: 0, max: 30, step: 1,
                unit: 'чел'
            },
            'ADMIN_AVG_SALARY': {
                label: 'Средняя ЗП АУП',
                type: 'driver',
                nodeId: 'ADMIN_AVG_SALARY',
                min: 30000, max: 300000, step: 10000,
                unit: '₽/мес'
            },
            'RENT': {
                label: 'Аренда',
                type: 'driver',
                nodeId: 'RENT',
                min: 0, max: 3000000, step: 20000,
                unit: '₽/мес',
                note: 'Торговая площадь дороже офисной'
            },
            'MARKETING': {
                label: 'Маркетинг',
                type: 'driver',
                nodeId: 'MARKETING',
                min: 0, max: 5000000, step: 10000,
                unit: '₽/мес',
                affects: ['VOLUME'],
                nonlinear: {
                    'VOLUME': {
                        type: 'diminishing_returns',
                        formula: 'VOLUME_base + a * MARKETING^b',
                        params: { a: 0.15, b: 0.45 },
                        lag: 1,
                        description: 'В рознице эффект маркетинга быстрее. Удвоение бюджета → +35% продаж через 1 месяц.'
                    }
                }
            },
            'IT_EXP': {
                label: 'IT-расходы',
                type: 'driver',
                nodeId: 'IT_EXP',
                min: 0, max: 1000000, step: 5000,
                unit: '₽/мес'
            },
            'OTHER_OPEX': {
                label: 'Прочие операционные',
                type: 'computed',
                children: ['TRAINING_COST', 'LEGAL_COST', 'BANK_FEES', 'INSURANCE_COST', 'UTILITIES', 'OFFICE_EXP', 'TRAVEL_COST', 'RD_EXP', 'OUTSOURCE_COST']
            },
            'TRAINING_COST': {
                label: 'Обучение',
                type: 'driver',
                nodeId: 'TRAINING_COST',
                min: 0, max: 500000, step: 5000,
                unit: '₽/мес'
            },
            'LEGAL_COST': {
                label: 'Юридические',
                type: 'driver',
                nodeId: 'LEGAL_COST',
                min: 0, max: 200000, step: 5000,
                unit: '₽/мес'
            },
            'BANK_FEES': {
                label: 'Комиссии банка',
                type: 'driver',
                nodeId: 'BANK_FEES',
                min: 0, max: 100000, step: 1000,
                unit: '₽/мес'
            },
            'INSURANCE_COST': {
                label: 'Страхование',
                type: 'driver',
                nodeId: 'INSURANCE_COST',
                min: 0, max: 200000, step: 5000,
                unit: '₽/мес'
            },
            'UTILITIES': {
                label: 'Коммунальные',
                type: 'driver',
                nodeId: 'UTILITIES',
                min: 0, max: 200000, step: 5000,
                unit: '₽/мес'
            },
            'OFFICE_EXP': {
                label: 'Офисные',
                type: 'driver',
                nodeId: 'OFFICE_EXP',
                min: 0, max: 100000, step: 2000,
                unit: '₽/мес'
            },
            'TRAVEL_COST': {
                label: 'Командировочные',
                type: 'driver',
                nodeId: 'TRAVEL_COST',
                min: 0, max: 300000, step: 5000,
                unit: '₽/мес'
            },
            'RD_EXP': {
                label: 'R&D',
                type: 'driver',
                nodeId: 'RD_EXP',
                min: 0, max: 1000000, step: 10000,
                unit: '₽/мес'
            },
            'OUTSOURCE_COST': {
                label: 'Аутсорсинг',
                type: 'driver',
                nodeId: 'OUTSOURCE_COST',
                min: 0, max: 1000000, step: 10000,
                unit: '₽/мес'
            },
            'INTEREST': {
                label: 'Проценты',
                type: 'driver',
                nodeId: 'INTEREST',
                computed: true
            },
            'TAX': {
                label: 'Налог на прибыль',
                type: 'driver',
                nodeId: 'TAX',
                computed: true
            }
        }
    }
};
