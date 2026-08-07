var INDUSTRY_PRESETS= {
    production: {

        name: 'Производство на заказ',
        description: 'Цех металлоконструкций, 18 сотрудников, ОСНО',
        nodes: {
            PRICE: 350000,
                VOLUME: 24,
                PROD_HEADCOUNT: 12,
                PROD_AVG_SALARY: 95000,
                ADMIN_HEADCOUNT: 4,
                ADMIN_AVG_SALARY: 120000,
                SALES_HEADCOUNT: 2,
                SALES_AVG_SALARY: 90000,
                UNIT_MATERIAL: 120000,
                ENERGY_COST: 85000,
                LOGISTICS_COST: 65000,
                RENT: 200000,
                MARKETING: 120000,
                IT_EXP: 25000,
                FIXED_ASSETS: 5000000,
                FIXED_ASSETS_START: 5000000,
                DA_RATE: 0.10,
                CASH_START: 2000000,
                CB_RATE: 0.21,
                INFLATION: 0.07,
                FX_RATE: 95,
                TAX_RATE: 0.25
        }

        ,
        company: {
            tax_system: 'OSNO',
                nds_rate: 0.22,
                profit_tax_rate: 0.25,
                insurance_rate: 0.30,
                receivables_days: 30,
                prepay_pct: 30,
                prepay_days: 15,
                prepay_share: 40,
                season: [0.8, 0.7, 0.9, 1.0, 1.1, 1.2, 1.3, 1.2, 1.0, 0.9, 0.8, 1.1],
                salary_mode: 'gross',
                materials_with_nds: true,
                rent_with_nds: true,
                logistics_with_nds: true,
                it_with_nds: true,
                fa_start_value: 5000000,
                fa_start_da: 0,
                fa_da_rate: 0.10,
                fa_remaining_months: 60
        }
    }

    ,

    it: {

        name: 'IT-студия',
        description: 'Веб-разработка и мобильные приложения, 14 человек, УСН 15%',
        nodes: {
            MONTHLY_RATE_PER_DEV: 260000,
                DEV_HEADCOUNT: 10,
                UTILIZATION: 80,
                DEV_AVG_SALARY: 180000,
                ADMIN_HEADCOUNT: 2,
                ADMIN_AVG_SALARY: 130000,
                SALES_HEADCOUNT: 2,
                SALES_AVG_SALARY: 100000,
                RENT: 120000,
                MARKETING: 80000,
                IT_EXP: 60000,
                CASH_START: 3000000,
                TAX_RATE: 0.15
        }

        ,
        company: {
            tax_system: 'USN_INCOME_MINUS',
                nds_rate: 0,
                nds_exempt: true,
                profit_tax_rate: 0.15,
                insurance_rate: 0.15,
                receivables_days: 45,
                prepay_pct: 50,
                prepay_days: 15,
                prepay_share: 60,
                season: [0.9, 0.9, 1.0, 1.0, 1.0, 1.1, 1.1, 1.0, 1.2, 1.2, 1.0, 0.8],
                salary_mode: 'net',
                materials_with_nds: true,
                rent_with_nds: true,
                logistics_with_nds: false,
                it_with_nds: true,
                fa_start_value: 0,
                fa_start_da: 0,
                fa_da_rate: 0,
                fa_remaining_months: 0
        }
    }

    ,

    services: {

        name: 'Сервисная компания',
        description: 'Маркетинговое агентство, 10 человек, ОСНО',
        nodes: {
            HOURLY_RATE: 3500,
                HOURS_SOLD: 1200,
                AVG_CHECK: 45000,
                CLIENTS: 25,
                SPECIALIST_HEADCOUNT: 8,
                SPECIALIST_AVG_SALARY: 95000,
                ADMIN_HEADCOUNT: 2,
                ADMIN_AVG_SALARY: 120000,
                SALES_HEADCOUNT: 2,
                SALES_AVG_SALARY: 80000,
                RENT: 100000,
                MARKETING: 120000,
                IT_EXP: 40000,
                CASH_START: 1500000,
                TAX_RATE: 0.25
        }

        ,
        company: {
            tax_system: 'OSNO',
                nds_rate: 0.22,
                profit_tax_rate: 0.25,
                insurance_rate: 0.30,
                receivables_days: 30,
                prepay_pct: 50,
                prepay_days: 10,
                prepay_share: 30,
                season: [0.8, 0.8, 1.0, 1.1, 1.1, 1.2, 1.2, 1.1, 1.3, 1.2, 1.0, 0.7],
                salary_mode: 'gross',
                materials_with_nds: false,
                rent_with_nds: true,
                logistics_with_nds: false,
                it_with_nds: true,
                fa_start_value: 0,
                fa_start_da: 0,
                fa_da_rate: 0,
                fa_remaining_months: 0
        }
    }

    ,

    retail: {

        name: 'Магазин одежды',
        description: 'Офлайн-магазин женской одежды в ТЦ, 8 человек, УСН 6%',
        nodes: {
            PRICE: 4500,
                VOLUME: 845,
                SALES_HEADCOUNT: 4,
                SALES_AVG_SALARY: 65000,
                ADMIN_HEADCOUNT: 2,
                ADMIN_AVG_SALARY: 110000,
                WAREHOUSE_STAFF: 2,
                WAREHOUSE_AVG_SALARY: 55000,
                UNIT_PURCHASE: 2045,
                RETURN_RATE: 8,
                RENT: 350000,
                MARKETING: 90000,
                LOGISTICS_COST: 35000,
                CASH_START: 2500000,
                TAX_RATE: 0.06
        }

        ,
        company: {
            tax_system: 'USN_INCOME',
                nds_rate: 0,
                nds_exempt: true,
                profit_tax_rate: 0.06,
                insurance_rate: 0.15,
                receivables_days: 0,
                prepay_pct: 0,
                prepay_days: 0,
                prepay_share: 0,
                season: [0.7, 0.6, 1.0, 0.9, 0.8, 0.7, 0.6, 1.5, 1.8, 1.0, 1.2, 2.0],
                salary_mode: 'net',
                materials_with_nds: true,
                rent_with_nds: true,
                logistics_with_nds: true,
                it_with_nds: false,
                fa_start_value: 0,
                fa_start_da: 0,
                fa_da_rate: 0,
                fa_remaining_months: 0
        }
    }

    ,

    logistics_carrier: {

        name: 'Транспортная компания',
        description: 'Свой автопарк, 15 грузовиков, ОСНО',
        nodes: {
            RATE_PER_KM: 55,
                KM_PER_MONTH: 150000,
                TRUCKS_COUNT: 15,
                FUEL_PRICE: 65,
                FUEL_CONSUMPTION: 35,
                TOLL_ROADS_PCT: 15,
                TOLL_ROADS_COST: 30000,
                TIRES_COST: 45000,
                AVG_KM_PER_TRUCK: 10000,
                MAINTENANCE_COST: 60000,
                INSURANCE_COST: 120000,
                DRIVERS_HEADCOUNT: 18,
                DRIVERS_AVG_SALARY: 95000,
                TRAVEL_COST: 80000,
                FINES_COST: 15000,
                DISPATCH_SERVICE: 50000,
                ADMIN_HEADCOUNT: 3,
                ADMIN_AVG_SALARY: 110000,
                RENT: 80000,
                IT_EXP: 45000,
                MARKETING: 60000,
                BANK_FEES: 15000,
                FIXED_ASSETS: 25000000,
                DA_RATE: 0.12,
                CASH_START: 3000000,
                TAX_RATE: 0.25
        }

        ,
        company: {
            tax_system: 'OSNO',
                nds_rate: 0.22,
                profit_tax_rate: 0.25,
                insurance_rate: 0.30,
                receivables_days: 45,
                prepay_pct: 30,
                prepay_days: 5,
                prepay_share: 50,
                season: [0.6, 0.7, 1.0, 1.1, 1.2, 1.3, 1.5, 1.4, 1.2, 1.0, 0.9, 1.1],
                salary_mode: 'gross',
                fa_start_value: 25000000,
                fa_start_da: 0,
                fa_da_rate: 0.12,
                fa_remaining_months: 60
        }
    }

    ,

    logistics_expeditor: {

        name: 'Экспедиторская компания',
        description: 'Без автопарка, 8 логистов, ОСНО',
        nodes: {
            RATE_PER_KM: 55,
                KM_PER_MONTH: 120000,
                CARRIER_RATE: 42,
                LOGISTICS_HEADCOUNT: 8,
                LOGISTICS_AVG_SALARY: 85000,
                SALES_HEADCOUNT: 2,
                SALES_AVG_SALARY: 75000,
                CLAIMS_RESERVE: 2,
                TENNERS_COST: 25000,
                ADMIN_HEADCOUNT: 2,
                ADMIN_AVG_SALARY: 120000,
                RENT: 70000,
                IT_EXP: 50000,
                MARKETING: 80000,
                BANK_FEES: 20000,
                CASH_START: 2000000,
                TAX_RATE: 0.25
        }

        ,
        company: {
            tax_system: 'OSNO',
                nds_rate: 0.22,
                profit_tax_rate: 0.25,
                insurance_rate: 0.30,
                receivables_days: 60,
                prepay_pct: 50,
                prepay_days: 3,
                prepay_share: 20,
                season: [0.6, 0.7, 1.0, 1.1, 1.2, 1.3, 1.5, 1.4, 1.2, 1.0, 0.9, 1.1],
                salary_mode: 'gross',
                fa_start_value: 0,
                fa_start_da: 0,
                fa_da_rate: 0,
                fa_remaining_months: 0
        }
    }
}

;
