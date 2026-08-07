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
                affects: ['REVENUE', 'MATERIAL_COST', 'ENERGY_COST', 'LOGISTICS_COST', 'PROD_HEADCOUNT', 'ADMIN_HEADCOUNT', 'DEFECT_COST'],
                nonlinear: {
                    'PROD_HEADCOUNT': {
                        type: 'step',
                        paramNode: 'PROD_CAPACITY_PER_WORKER',
                        defaultValue: 15,
                        description: '1 рабочий = 15 ед/мес. При нехватке — переработка до 30%, затем наём.'
                    },
                    'ADMIN_HEADCOUNT': {
                        type: 'span_of_control',
                        description: 'АУП растёт ступенчато: до 10 раб = 2 чел, до 25 = 3, до 50 = 4, до 100 = 6.'
                    },
                    'ENERGY_COST': {
                        type: 'two_part',
                        params: { base: 15000, perUnit: 350 },
                        description: '15 000 постоянные + 350 ₽/ед переменные'
                    },
                    'LOGISTICS_COST': {
                        type: 'batch_step',
                        params: { base: 10000, batchSize: 50, batchCost: 8000 },
                        description: '10 000 содержание + 8 000 за каждые 50 ед (полная фура)'
                    },
                    'UNIT_MATERIAL': {
                        type: 'scale_discount',
                        params: {
                            maxDiscount: 0.15,
                            tiers: [
                                { ratio: 10, discount: 0.15 },
                                { ratio: 5, discount: 0.12 },
                                { ratio: 3, discount: 0.08 },
                                { ratio: 2, discount: 0.05 },
                                { ratio: 1.5, discount: 0.03 }
                            ]
                        },
                        description: 'Скидка поставщика: +50% к объёму = 3%, ×2 = 5%, ×3 = 8%, ×5 = 12%, ×10 = 15% (макс)'
                    },
                    'DEFECT_COST': {
                        type: 'defect',
                        params: { baseRate: 2, ratePerOvertime: 0.05, normalPerWorker: 15 },
                        description: 'Брак: 2% база + 0.05% за каждый % переработки сверх нормы'
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
                min: 0, max: 1000000, step: 10000,
                unit: '₽/мес',
                affects: ['VOLUME'],
                nonlinear: {
                    'VOLUME': {
                        type: 'diminishing_returns',
                        params: { a: 0.15, saturation: 500000 },
                        lag: 2,
                        description: 'Удвоение бюджета → +10-15% объёма. Эффект затухает к 500К.'
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
                affects: ['REVENUE', 'UTILIZATION'],
                nonlinear: {
                    'UTILIZATION': {
                        type: 'elasticity',
                        elasticityNode: 'RATE_ELASTICITY',
                        defaultValue: -0.5,
                        description: 'При росте ставки на 10% утилизация падает на 5% (часть клиентов уходит к конкурентам)'
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
                affects: ['REVENUE', 'DEV_PAYROLL', 'UTILIZATION', 'ADMIN_HEADCOUNT', 'IT_EXP'],
                nonlinear: {
                    'UTILIZATION': {
                        type: 'ramp_up',
                        params: { rampUpLoss: 0.15 },
                        description: 'Новые разработчики: -15% утилизации команды пока входят в проекты (2-3 мес)'
                    },
                    'ADMIN_HEADCOUNT': {
                        type: 'span_of_control_it',
                        description: 'АУП растёт: до 10 разрабов = 1 админ, до 25 = 2, до 50 = 3, далее 1 админ на 25 разработчиков'
                    },
                    'IT_EXP': {
                        type: 'per_head_with_discount',
                        params: {
                            costPerHead: 15000,
                            maxDiscount: 0.20,
                            tiers: [
                                { headcount: 100, discount: 0.20 },
                                { headcount: 50, discount: 0.15 },
                                { headcount: 25, discount: 0.10 },
                                { headcount: 10, discount: 0.05 }
                            ]
                        },
                        description: 'Рабочее место: 15 000 ₽/чел. Скидки: >10 чел = 5%, >25 = 10%, >50 = 15%, >100 = 20% (корпоративные лицензии)'
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
                        paramNodes: { threshold: 'OVERTIME_THRESHOLD', rate: 'OVERTIME_RATE' },
                        defaultThreshold: 85,
                        defaultRate: 0.5,
                        description: 'При утилизации >85% — сверхурочные. Каждый % выше = +0.5% к ФОТ. При >95% — выгорание и увольнения.'
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
                unit: '₽/мес',
                affects: ['DEV_PAYROLL', 'DEV_HEADCOUNT'],
                nonlinear: {
                    'DEV_HEADCOUNT': {
                        type: 'elasticity',
                        defaultValue: -0.3,
                        description: 'При росте ЗП на 10% — приток кадров, можно нанять на 3% больше людей'
                    }
                }
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
                drivers: ['ADMIN_AVG_SALARY']
            },
            'ADMIN_HEADCOUNT': {
                label: 'Административный персонал',
                type: 'driver',
                nodeId: 'ADMIN_HEADCOUNT',
                min: 0, max: 30, step: 1,
                unit: 'чел',
                affects: ['ADMIN_PAYROLL']
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
                unit: '₽/мес',
                affects: [],
                nonlinear: {
                    'RENT': {
                        type: 'per_head_space',
                        params: { sqmPerHead: 6, costPerSqm: 2000 },
                        description: '6 м² на разработчика × 2000 ₽/м². При найме аренда растёт.'
                    }
                }
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
                        params: { a: 0.08, saturation: 2000000 },
                        lag: 3,
                        description: 'Маркетинг → лиды → новые проекты → наём. Удвоение бюджета → +5-8% команды через 3 мес. Эффект затухает к 2 млн.'
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
                children: ['TRAINING_COST', 'LEGAL_COST', 'BANK_FEES', 'INSURANCE_COST', 'UTILITIES', 'OFFICE_EXP', 'TRAVEL_COST', 'RD_EXP']
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
                unit: '₽/час',
                affects: ['HOURLY_REVENUE', 'HOURS_SOLD'],
                nonlinear: {
                    'HOURS_SOLD': {
                        type: 'elasticity',
                        defaultValue: -0.4,
                        description: 'При росте ставки на 10% оплаченных часов становится на 4% меньше'
                    }
                }
            },
            'HOURS_SOLD': {
                label: 'Оплаченные часы',
                type: 'driver',
                nodeId: 'HOURS_SOLD',
                min: 0, max: 5000, step: 50,
                unit: 'часов/мес',
                affects: ['HOURLY_REVENUE', 'SPECIALIST_HEADCOUNT'],
                nonlinear: {
                    'SPECIALIST_HEADCOUNT': {
                        type: 'step',
                        paramNode: 'HOURS_PER_SPECIALIST',
                        defaultValue: 160,
                        description: '1 специалист = 160 ч/мес. При росте часов автоматически нанимаем. До 20% переработки без найма.'
                    }
                }
            },
            'HOURS_PER_SPECIALIST': {
                label: 'Часов на специалиста в месяц',
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
                unit: '₽',
                affects: ['CHECK_REVENUE', 'CLIENTS'],
                nonlinear: {
                    'CLIENTS': {
                        type: 'elasticity',
                        defaultValue: -0.6,
                        description: 'При росте чека на 10% поток клиентов падает на 6%'
                    }
                }
            },
            'CLIENTS': {
                label: 'Количество клиентов',
                type: 'driver',
                nodeId: 'CLIENTS',
                min: 0, max: 5000, step: 10,
                unit: 'чел/мес',
                affects: ['CHECK_REVENUE', 'SPECIALIST_HEADCOUNT', 'MARKETING'],
                nonlinear: {
                    'SPECIALIST_HEADCOUNT': {
                        type: 'step',
                        paramNode: 'CLIENTS_PER_SPECIALIST',
                        defaultValue: 50,
                        description: '1 специалист обслуживает 50 клиентов/мес. При росте потока — наём.'
                    },
                    'MARKETING': {
                        type: 'scale_efficiency',
                        params: {
                            baseCPC: 500,
                            efficiencyGain: 0.10,
                            threshold: 500
                        },
                        description: 'При >500 клиентов/мес — стоимость привлечения падает на 10% (сарафанное радио, бренд)'
                    }
                }
            },
            'CLIENTS_PER_SPECIALIST': {
                label: 'Клиентов на специалиста',
                type: 'hidden',
                nodeId: 'CLIENTS_PER_SPECIALIST',
                defaultValue: 50
            },
            'SPECIALIST_PAYROLL': {
                label: 'ФОТ специалистов',
                type: 'computed',
                children: ['SPECIALIST_HEADCOUNT', 'SPECIALIST_AVG_SALARY'],
                formula: 'SPECIALIST_HEADCOUNT * SPECIALIST_AVG_SALARY',
                drivers: ['SPECIALIST_AVG_SALARY']
            },
            'SPECIALIST_HEADCOUNT': {
                label: 'Специалисты',
                type: 'driver',
                nodeId: 'SPECIALIST_HEADCOUNT',
                min: 1, max: 200, step: 1,
                unit: 'чел',
                affects: ['SPECIALIST_PAYROLL', 'HOURS_SOLD', 'CLIENTS'],
                nonlinear: {
                    'HOURS_SOLD': {
                        type: 'capacity',
                        paramNode: 'HOURS_PER_SPECIALIST',
                        defaultValue: 160,
                        description: 'Максимум часов = специалисты × 160 ч/мес'
                    },
                    'CLIENTS': {
                        type: 'capacity',
                        paramNode: 'CLIENTS_PER_SPECIALIST',
                        defaultValue: 50,
                        description: 'Максимум клиентов = специалисты × 50 чел/мес'
                    },
                    'RENT': {
                        type: 'space_efficiency',
                        params: {
                            sqmPerHead: 6,
                            costPerSqm: 2000,
                            efficiencyThreshold: 10,
                            efficiencyGain: 0.15
                        },
                        description: 'До 10 чел — 6 м²/чел. После 10 чел — эффективнее на 15% (open space, shared desks)'
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
                        params: { a: 0.1, saturation: 2000000 },
                        lag: 2,
                        description: 'Удвоение бюджета → +7-10% клиентов через 2 мес. Эффект затухает к 2 млн.'
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
                formula: 'REVENUE - COGS'
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
                affects: ['REVENUE', 'UNIT_PURCHASE', 'WAREHOUSE_STAFF', 'SALES_HEADCOUNT', 'LOGISTICS_COST', 'RETURN_COST'],
                nonlinear: {
                    'UNIT_PURCHASE': {
                        type: 'scale_discount',
                        params: {
                            maxDiscount: 0.15,
                            tiers: [
                                { ratio: 10, discount: 0.15 },
                                { ratio: 5, discount: 0.12 },
                                { ratio: 3, discount: 0.08 },
                                { ratio: 2, discount: 0.05 },
                                { ratio: 1.5, discount: 0.03 }
                            ]
                        },
                        description: 'Скидка поставщика: +50% к объёму = 3%, ×2 = 5%, ×3 = 8%, ×5 = 12%, ×10 = 15% (макс)'
                    },
                    'WAREHOUSE_STAFF': {
                        type: 'step',
                        paramNode: 'UNITS_PER_WAREHOUSE_WORKER',
                        defaultValue: 500,
                        description: '1 сотрудник склада = 500 ед/мес обработки'
                    },
                    'SALES_HEADCOUNT': {
                        type: 'step',
                        paramNode: 'UNITS_PER_SALESPERSON',
                        defaultValue: 150,
                        description: '1 продавец = 150 ед/мес. При нехватке — падение объёма.'
                    },
                    'LOGISTICS_COST': {
                        type: 'batch_step',
                        params: { base: 15000, batchSize: 100, batchCost: 12000 },
                        description: '15 000 содержание + 12 000 за каждые 100 ед доставки'
                    },
                    'RETURN_COST': {
                        type: 'percent_of_revenue',
                        params: { baseRate: 2, fatigueRate: 0.01 },
                        description: 'Возвраты: 2% база + 0.01% за каждый % превышения нормы продавца'
                    }
                }
            },
            'UNITS_PER_WAREHOUSE_WORKER': {
                label: 'Единиц на сотрудника склада',
                type: 'hidden',
                nodeId: 'UNITS_PER_WAREHOUSE_WORKER',
                defaultValue: 500
            },
            'UNITS_PER_SALESPERSON': {
                label: 'Единиц на продавца',
                type: 'hidden',
                nodeId: 'UNITS_PER_SALESPERSON',
                defaultValue: 150
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
                        elasticityNode: 'PRICE_ELASTICITY',
                        defaultValue: -1.2,
                        description: 'Розница: при росте цены на 10% объём падает на 12% (высокая конкуренция)'
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
                children: ['PURCHASE_COST', 'WAREHOUSE_PAYROLL', 'LOGISTICS_COST', 'RETURN_COST']
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
                drivers: ['WAREHOUSE_AVG_SALARY']
            },
            'WAREHOUSE_STAFF': {
                label: 'Персонал склада',
                type: 'driver',
                nodeId: 'WAREHOUSE_STAFF',
                min: 1, max: 100, step: 1,
                unit: 'чел',
                affects: ['WAREHOUSE_PAYROLL', 'VOLUME'],
                nonlinear: {
                    'VOLUME': {
                        type: 'capacity',
                        paramNode: 'UNITS_PER_WAREHOUSE_WORKER',
                        defaultValue: 500,
                        description: 'Максимальный объём = склад × 500 ед/мес'
                    }
                }
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
                children: ['SALES_PAYROLL', 'ADMIN_PAYROLL', 'RENT', 'MARKETING', 'IT_EXP', 'OTHER_OPEX']
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
                affects: ['SALES_PAYROLL', 'VOLUME'],
                nonlinear: {
                    'VOLUME': {
                        type: 'capacity',
                        paramNode: 'UNITS_PER_SALESPERSON',
                        defaultValue: 150,
                        description: 'Максимальный объём = продавцы × 150 ед/мес'
                    }
                }
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
                unit: '₽/мес'
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
                        params: { a: 0.12, saturation: 3000000 },
                        lag: 1,
                        description: 'Розница: эффект быстрее. Удвоение бюджета → +8-12% объёма через 1 мес.'
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
    },

    // ============================================================
    // ЛОГИСТИКА — СВОЙ АВТОПАРК
    // ============================================================
    logistics_carrier: {
        root: 'NET_PROFIT',
        label: 'Логистика (свой автопарк)',
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
                children: ['RATE_PER_KM', 'KM_PER_MONTH'],
                formula: 'RATE_PER_KM * KM_PER_MONTH',
                drivers: ['RATE_PER_KM', 'KM_PER_MONTH']
            },
            'RATE_PER_KM': {
                label: 'Ставка за 1 км',
                type: 'driver',
                nodeId: 'RATE_PER_KM',
                min: 30, max: 100, step: 1,
                unit: '₽/км',
                affects: ['REVENUE']
            },
            'KM_PER_MONTH': {
                label: 'Пробег в месяц',
                type: 'driver',
                nodeId: 'KM_PER_MONTH',
                min: 10000, max: 500000, step: 5000,
                unit: 'км',
                affects: ['REVENUE', 'FUEL_COST', 'TOLL_ROADS_COST', 'TIRES_COST', 'MAINTENANCE_COST'],
                nonlinear: {
                    'FUEL_COST': {
                        type: 'two_part',
                        params: { base: 0, perUnit: 0.35 },
                        description: 'Топливо = пробег × расход / 100 × цена'
                    },
                    'TOLL_ROADS_COST': {
                        type: 'two_part',
                        params: { base: 0, perUnit: 0.2 },
                        description: 'Платные дороги ~20% от пробега'
                    }
                }
            },
            'TOTAL_COSTS': {
                label: 'Общие расходы',
                type: 'computed',
                children: ['COGS', 'OPEX', 'INTEREST', 'TAX']
            },
            'COGS': {
                label: 'Себестоимость',
                type: 'computed',
                children: ['FUEL_COST', 'DRIVERS_PAYROLL', 'TOLL_ROADS_COST', 'TIRES_COST', 'MAINTENANCE_COST', 'INSURANCE_COST', 'DISPATCH_SERVICE', 'TRAVEL_COST', 'FINES_COST']
            },
            'FUEL_PRICE': {
                label: 'Цена дизеля',
                type: 'driver',
                nodeId: 'FUEL_PRICE',
                min: 40, max: 100, step: 1,
                unit: '₽/л',
                affects: ['FUEL_COST']
            },
            'FUEL_CONSUMPTION': {
                label: 'Расход топлива',
                type: 'driver',
                nodeId: 'FUEL_CONSUMPTION',
                min: 25, max: 50, step: 1,
                unit: 'л/100км'
            },
            'DRIVERS_HEADCOUNT': {
                label: 'Водители',
                type: 'driver',
                nodeId: 'DRIVERS_HEADCOUNT',
                min: 1, max: 200, step: 1,
                unit: 'чел',
                affects: ['DRIVERS_PAYROLL']
            },
            'DRIVERS_AVG_SALARY': {
                label: 'ЗП водителя',
                type: 'driver',
                nodeId: 'DRIVERS_AVG_SALARY',
                min: 50000, max: 200000, step: 5000,
                unit: '₽/мес'
            },
            'TRUCKS_COUNT': {
                label: 'Количество тягачей',
                type: 'driver',
                nodeId: 'TRUCKS_COUNT',
                min: 1, max: 200, step: 1,
                unit: 'ед',
                affects: ['KM_PER_MONTH'],
                nonlinear: {
                    'KM_PER_MONTH': {
                        type: 'capacity',
                        paramNode: 'AVG_KM_PER_TRUCK',
                        defaultValue: 10000,
                        description: 'Пробег = тягачи × средний пробег на тягач'
                    }
                }
            },
            'AVG_KM_PER_TRUCK': {
                label: 'Средний пробег на тягач',
                type: 'hidden',
                nodeId: 'AVG_KM_PER_TRUCK',
                defaultValue: 10000
            },
            'TOLL_ROADS_COST': {
                label: 'Платные дороги',
                type: 'driver',
                nodeId: 'TOLL_ROADS_COST',
                min: 0, max: 500000, step: 5000,
                unit: '₽/мес'
            },
            'TIRES_COST': {
                label: 'Резина',
                type: 'driver',
                nodeId: 'TIRES_COST',
                min: 0, max: 200000, step: 5000,
                unit: '₽/мес'
            },
            'MAINTENANCE_COST': {
                label: 'ТО и ремонт',
                type: 'driver',
                nodeId: 'MAINTENANCE_COST',
                min: 0, max: 300000, step: 5000,
                unit: '₽/мес'
            },
            'OPEX': {
                label: 'Операционные расходы',
                type: 'computed',
                children: ['ADMIN_PAYROLL', 'RENT', 'IT_EXP', 'MARKETING', 'BANK_FEES', 'OTHER_OPEX']
            },
            'ADMIN_PAYROLL': {
                label: 'ФОТ АУП',
                type: 'computed',
                children: ['ADMIN_HEADCOUNT', 'ADMIN_AVG_SALARY'],
                formula: 'ADMIN_HEADCOUNT * ADMIN_AVG_SALARY',
                drivers: ['ADMIN_HEADCOUNT', 'ADMIN_AVG_SALARY']
            },
            'ADMIN_HEADCOUNT': {
                label: 'АУП',
                type: 'driver',
                nodeId: 'ADMIN_HEADCOUNT',
                min: 0, max: 30, step: 1,
                unit: 'чел'
            },
            'ADMIN_AVG_SALARY': {
                label: 'ЗП АУП',
                type: 'driver',
                nodeId: 'ADMIN_AVG_SALARY',
                min: 50000, max: 300000, step: 10000,
                unit: '₽/мес'
            },
            'RENT': {
                label: 'Аренда',
                type: 'driver',
                nodeId: 'RENT',
                min: 0, max: 500000, step: 10000,
                unit: '₽/мес'
            },
            'IT_EXP': {
                label: 'IT-расходы',
                type: 'driver',
                nodeId: 'IT_EXP',
                min: 0, max: 200000, step: 5000,
                unit: '₽/мес'
            },
            'MARKETING': {
                label: 'Маркетинг',
                type: 'driver',
                nodeId: 'MARKETING',
                min: 0, max: 500000, step: 10000,
                unit: '₽/мес'
            },
            'OTHER_OPEX': {
                label: 'Прочие',
                type: 'computed',
                children: ['BANK_FEES', 'INSURANCE_COST', 'UTILITIES', 'OFFICE_EXP', 'TRAVEL_COST']
            },
            'INTEREST': { label: 'Проценты', type: 'driver', nodeId: 'INTEREST', computed: true },
            'TAX': { label: 'Налог', type: 'driver', nodeId: 'TAX', computed: true }
        }
    },

    // ============================================================
    // ЛОГИСТИКА — ЭКСПЕДИТОР
    // ============================================================
    logistics_expeditor: {
        root: 'NET_PROFIT',
        label: 'Логистика (экспедитор)',
        nodes: {
            'NET_PROFIT': {
                label: 'Чистая прибыль',
                type: 'result',
                children: ['MARGIN', 'TOTAL_COSTS'],
                signs: { 'MARGIN': 1, 'TOTAL_COSTS': -1 }
            },
            'MARGIN': {
                label: 'Маржа',
                type: 'computed',
                children: ['REVENUE', 'CARRIER_COST'],
                formula: 'REVENUE - CARRIER_COST',
                drivers: []
            },
            'REVENUE': {
                label: 'Выручка',
                type: 'computed',
                children: ['RATE_PER_KM', 'KM_PER_MONTH'],
                formula: 'RATE_PER_KM * KM_PER_MONTH',
                drivers: ['RATE_PER_KM', 'KM_PER_MONTH']
            },
            'RATE_PER_KM': {
                label: 'Ставка клиента',
                type: 'driver',
                nodeId: 'RATE_PER_KM',
                min: 30, max: 100, step: 1,
                unit: '₽/км',
                affects: ['REVENUE', 'MARGIN']
            },
            'KM_PER_MONTH': {
                label: 'Пробег в месяц',
                type: 'driver',
                nodeId: 'KM_PER_MONTH',
                min: 10000, max: 500000, step: 5000,
                unit: 'км',
                affects: ['REVENUE', 'CARRIER_COST']
            },
            'CARRIER_RATE': {
                label: 'Ставка перевозчика',
                type: 'driver',
                nodeId: 'CARRIER_RATE',
                min: 25, max: 60, step: 1,
                unit: '₽/км',
                affects: ['CARRIER_COST', 'MARGIN']
            },
            'CARRIER_COST': {
                label: 'Оплата перевозчикам',
                type: 'computed',
                children: ['KM_PER_MONTH', 'CARRIER_RATE'],
                formula: 'KM_PER_MONTH * CARRIER_RATE',
                drivers: []
            },
            'TOTAL_COSTS': {
                label: 'Общие расходы',
                type: 'computed',
                children: ['COGS', 'OPEX', 'INTEREST', 'TAX']
            },
            'COGS': {
                label: 'Себестоимость',
                type: 'computed',
                children: ['CARRIER_COST', 'LOGISTICS_PAYROLL', 'CLAIMS_RESERVE']
            },
            'LOGISTICS_HEADCOUNT': {
                label: 'Логисты',
                type: 'driver',
                nodeId: 'LOGISTICS_HEADCOUNT',
                min: 1, max: 100, step: 1,
                unit: 'чел',
                affects: ['LOGISTICS_PAYROLL', 'KM_PER_MONTH'],
                nonlinear: {
                    'KM_PER_MONTH': {
                        type: 'capacity',
                        paramNode: 'KM_PER_LOGISTICIAN',
                        defaultValue: 15000,
                        description: '1 логист = ~15 000 км/мес'
                    }
                }
            },
            'KM_PER_LOGISTICIAN': {
                label: 'Км на логиста',
                type: 'hidden',
                nodeId: 'KM_PER_LOGISTICIAN',
                defaultValue: 15000
            },
            'LOGISTICS_AVG_SALARY': {
                label: 'ЗП логиста',
                type: 'driver',
                nodeId: 'LOGISTICS_AVG_SALARY',
                min: 50000, max: 200000, step: 5000,
                unit: '₽/мес'
            },
            'CLAIMS_RESERVE': {
                label: 'Претензии',
                type: 'driver',
                nodeId: 'CLAIMS_RESERVE',
                min: 0, max: 10, step: 0.5,
                unit: '%'
            },
            'TENNERS_COST': {
                label: 'Тендеры',
                type: 'driver',
                nodeId: 'TENNERS_COST',
                min: 0, max: 100000, step: 5000,
                unit: '₽/мес'
            },
            'OPEX': {
                label: 'Операционные расходы',
                type: 'computed',
                children: ['ADMIN_PAYROLL', 'SALES_PAYROLL', 'RENT', 'IT_EXP', 'MARKETING', 'BANK_FEES', 'TENNERS_COST']
            },
            'ADMIN_PAYROLL': {
                label: 'ФОТ АУП',
                type: 'computed',
                children: ['ADMIN_HEADCOUNT', 'ADMIN_AVG_SALARY'],
                formula: 'ADMIN_HEADCOUNT * ADMIN_AVG_SALARY',
                drivers: ['ADMIN_HEADCOUNT', 'ADMIN_AVG_SALARY']
            },
            'ADMIN_HEADCOUNT': {
                label: 'АУП',
                type: 'driver',
                nodeId: 'ADMIN_HEADCOUNT',
                min: 0, max: 20, step: 1,
                unit: 'чел'
            },
            'ADMIN_AVG_SALARY': {
                label: 'ЗП АУП',
                type: 'driver',
                nodeId: 'ADMIN_AVG_SALARY',
                min: 50000, max: 300000, step: 10000,
                unit: '₽/мес'
            },
            'SALES_HEADCOUNT': {
                label: 'Продавцы',
                type: 'driver',
                nodeId: 'SALES_HEADCOUNT',
                min: 0, max: 20, step: 1,
                unit: 'чел'
            },
            'SALES_AVG_SALARY': {
                label: 'ЗП продавцов',
                type: 'driver',
                nodeId: 'SALES_AVG_SALARY',
                min: 40000, max: 200000, step: 5000,
                unit: '₽/мес'
            },
            'RENT': {
                label: 'Аренда',
                type: 'driver',
                nodeId: 'RENT',
                min: 0, max: 300000, step: 10000,
                unit: '₽/мес'
            },
            'IT_EXP': {
                label: 'IT-расходы',
                type: 'driver',
                nodeId: 'IT_EXP',
                min: 0, max: 200000, step: 5000,
                unit: '₽/мес'
            },
            'MARKETING': {
                label: 'Маркетинг',
                type: 'driver',
                nodeId: 'MARKETING',
                min: 0, max: 500000, step: 10000,
                unit: '₽/мес'
            },
            'INTEREST': { label: 'Проценты', type: 'driver', nodeId: 'INTEREST', computed: true },
            'TAX': { label: 'Налог', type: 'driver', nodeId: 'TAX', computed: true }
        }
    }
};

var MACRO_FORMULAS = {
    // Общие для всех отраслей
    common: {
        'INFLATION': {
            'ADMIN_AVG_SALARY': { coeff: 0.8, type: 'relative', desc: 'Рост инфляции → индексация ЗП АУП' }
        },
        'LABOR_INDEX': {
            'ADMIN_AVG_SALARY': { coeff: 0.4, type: 'relative', desc: 'Дефицит кадров → рост ЗП АУП' }
        }
    },

    // Производство
    production: {
        'CB_RATE': {
            'VOLUME': { coeff: -0.15, type: 'absolute_pct', desc: 'Ставка ↑ → спрос ↓ → объём ↓' }
        },
        'INFLATION': {
            'PROD_AVG_SALARY': { coeff: 0.8, type: 'relative', desc: 'Инфляция → индексация ЗП' },
            'PRICE': { coeff: 0.6, type: 'relative', desc: 'Инфляция → рост цен' }
        },
        'FX_RATE': {
            'UNIT_MATERIAL': { coeff: 0.3, type: 'relative', desc: 'Курс ↑ → импортное сырьё дороже' }
        },
        'COMPETITION': {
            'VOLUME': { coeff: -0.25, type: 'absolute_pct', desc: 'Конкуренция ↑ → объём ↓' },
            'PRICE': { coeff: -0.2, type: 'absolute_pct', desc: 'Конкуренция ↑ → цена ↓' }
        },
        'TARIFFS': {
            'ENERGY_COST': { coeff: 0.5, type: 'relative', desc: 'Тарифы ↑ → энергия дороже' },
            'LOGISTICS_COST': { coeff: 0.5, type: 'relative', desc: 'Тарифы ↑ → логистика дороже' }
        },
        'LABOR_INDEX': {
            'PROD_AVG_SALARY': { coeff: 0.4, type: 'relative', desc: 'Дефицит кадров → рост ЗП' }
        }
    },

    // IT
    it: {
        'CB_RATE': {
            'UTILIZATION': { coeff: -0.3, type: 'absolute_pct', desc: 'Ставка ↑ → клиенты реже заказывают → утилизация ↓' }
        },
        'INFLATION': {
            'DEV_AVG_SALARY': { coeff: 0.8, type: 'relative', desc: 'Инфляция → индексация ЗП разработчиков' }
        },
        'COMPETITION': {
            'MONTHLY_RATE_PER_DEV': { coeff: -0.3, type: 'relative', desc: 'Конкуренция ↑ → ставку приходится снижать' },
            'UTILIZATION': { coeff: -0.2, type: 'absolute_pct', desc: 'Конкуренция ↑ → утилизация ↓' }
        },
        'LABOR_INDEX': {
            'DEV_AVG_SALARY': { coeff: 0.4, type: 'relative', desc: 'Дефицит кадров → рост ЗП' }
        },
        'TARIFFS': {
            'IT_EXP': { coeff: 0.3, type: 'relative', desc: 'Тарифы ↑ → облака и хостинг дороже' }
        }
    },

    // Услуги
    services: {
        'CB_RATE': {
            'HOURS_SOLD': { coeff: -0.1, type: 'absolute_pct', desc: 'Ставка ↑ → спрос на услуги ↓' },
            'CLIENTS': { coeff: -0.15, type: 'absolute_pct', desc: 'Ставка ↑ → клиентов меньше' }
        },
        'INFLATION': {
            'SPECIALIST_AVG_SALARY': { coeff: 0.8, type: 'relative', desc: 'Инфляция → индексация ЗП' },
            'HOURLY_RATE': { coeff: 0.5, type: 'relative', desc: 'Инфляция → рост ставок' },
            'AVG_CHECK': { coeff: 0.5, type: 'relative', desc: 'Инфляция → рост чеков' }
        },
        'COMPETITION': {
            'HOURLY_RATE': { coeff: -0.2, type: 'relative', desc: 'Конкуренция → ставки под давлением' },
            'AVG_CHECK': { coeff: -0.2, type: 'relative', desc: 'Конкуренция → чеки под давлением' },
            'CLIENTS': { coeff: -0.3, type: 'absolute_pct', desc: 'Конкуренция → клиентов меньше' }
        },
        'LABOR_INDEX': {
            'SPECIALIST_AVG_SALARY': { coeff: 0.4, type: 'relative', desc: 'Дефицит кадров → рост ЗП' }
        }
    },

    // Ритейл
    retail: {
        'CB_RATE': {
            'VOLUME': { coeff: -0.2, type: 'absolute_pct', desc: 'Ставка ↑ → покупательская способность ↓' }
        },
        'INFLATION': {
            'SALES_AVG_SALARY': { coeff: 0.8, type: 'relative', desc: 'Инфляция → индексация ЗП' },
            'WAREHOUSE_AVG_SALARY': { coeff: 0.8, type: 'relative', desc: 'Инфляция → индексация ЗП склада' },
            'PRICE': { coeff: 0.7, type: 'relative', desc: 'Инфляция → рост розничных цен' }
        },
        'FX_RATE': {
            'UNIT_PURCHASE': { coeff: 0.3, type: 'relative', desc: 'Курс ↑ → импортный товар дороже' }
        },
        'COMPETITION': {
            'VOLUME': { coeff: -0.35, type: 'absolute_pct', desc: 'Конкуренция → объём продаж ↓ (высокая чувствительность)' },
            'PRICE': { coeff: -0.25, type: 'absolute_pct', desc: 'Конкуренция → демпинг' }
        },
        'TARIFFS': {
            'LOGISTICS_COST': { coeff: 0.5, type: 'relative', desc: 'Тарифы → доставка дороже' }
        },
        'LABOR_INDEX': {
            'SALES_AVG_SALARY': { coeff: 0.4, type: 'relative', desc: 'Дефицит → рост ЗП продавцов' },
            'WAREHOUSE_AVG_SALARY': { coeff: 0.4, type: 'relative', desc: 'Дефицит → рост ЗП склада' }
        }
    }
};
