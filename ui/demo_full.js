var DEMO_FULL = "project:\n name: \"Полная модель компании\"\n version: 2\n\nnodes:\n - id: NET_PROFIT\n type: TARGET\n
label: \"Чистая прибыль\"\n source: computed\n\n - id: EBT\n type: INTERMEDIATE\n label: \"Прибыль до
налогообложения\"\n source: computed\n\n - id: TAX\n type: INTERMEDIATE\n label: \"Налог на прибыль\"\n source:
computed\n\n - id: TAX_RATE\n type: INPUT\n label: \"Ставка налога на прибыль\"\n value: 0.20\n min: 0.15\n max: 0.25\n
source: manual\n enabled: true\n\n - id: EBITDA\n type: INTERMEDIATE\n label: \"EBITDA\"\n source: computed\n\n - id:
DA\n type: INTERMEDIATE\n label: \"Амортизация\"\n source: computed\n\n - id: EBIT\n type: INTERMEDIATE\n label:
\"Операционная прибыль\"\n source: computed\n\n - id: INTEREST\n type: INTERMEDIATE\n label: \"Проценты к уплате\"\n
source: computed\n\n - id: INTEREST_INCOME\n type: INTERMEDIATE\n label: \"Проценты к получению\"\n source: computed\n\n
- id: OTHER_INCOME\n type: INPUT\n label: \"Прочие доходы\"\n value: 200000\n min: 0\n max: 1000000\n source: manual\n
enabled: true\n\n - id: OTHER_EXP\n type: INPUT\n label: \"Прочие расходы\"\n value: 100000\n min: 0\n max: 500000\n
source: manual\n enabled: true\n\n - id: PENALTIES\n type: INPUT\n label: \"Штрафы\"\n value: 0\n min: 0\n max:
10000000\n source: manual\n enabled: true\n\n - id: GROSS_PROFIT\n type: INTERMEDIATE\n label: \"Валовая прибыль\"\n
source: computed\n\n - id: REVENUE\n type: INTERMEDIATE\n label: \"Выручка\"\n source: computed\n\n - id: COGS\n type:
INTERMEDIATE\n label: \"Себестоимость\"\n source: computed\n\n - id: SELLING_EXP\n type: INTERMEDIATE\n label:
\"Коммерческие расходы\"\n source: computed\n\n - id: ADMIN_EXP\n type: INTERMEDIATE\n label: \"Управленческие
расходы\"\n source: computed\n\n - id: PRICE\n type: INPUT\n label: \"Цена\"\n value: 1200\n min: 900\n max: 1500\n
source: manual\n enabled: true\n\n - id: VOLUME\n type: INTERMEDIATE\n label: \"Объём продаж\"\n source: computed\n\n -
id: MARKETING\n type: INPUT\n label: \"Маркетинг\"\n value: 1200000\n min: 500000\n max: 2500000\n source: manual\n
enabled: true\n\n - id: SEASON\n type: INPUT\n label: \"Сезонность\"\n value: 1.0\n min: 0.7\n max: 1.3\n source:
manual\n enabled: true\n\n - id: BUSINESS_ACTIVITY\n type: INTERMEDIATE\n label: \"Деловая активность\"\n source:
computed\n\n - id: CB_RATE\n type: EXTERNAL\n label: \"Ставка ЦБ\"\n value: 18.0\n min: 5\n max: 25\n source: manual\n
enabled: true\n\n - id: PMI\n type: EXTERNAL\n label: \"Индекс PMI\"\n value: 52.0\n min: 40\n max: 65\n source:
manual\n enabled: true\n\n - id: CCI\n type: EXTERNAL\n label: \"Потребительская уверенность\"\n value: -8.0\n min:
-40\n max: 10\n source: manual\n enabled: true\n\n - id: SANCTIONS\n type: EXTERNAL\n label: \"Санкционный индекс\"\n
value: 0.7\n min: 0\n max: 1.0\n source: manual\n enabled: true\n\n - id: COMPETITION\n type: INPUT\n label:
\"Конкуренция\"\n value: 0.8\n min: 0.5\n max: 1.0\n source: manual\n enabled: true\n\n - id: HOUSEHOLD_INCOME\n type:
EXTERNAL\n label: \"Доходы населения\"\n value: 55000\n min: 30000\n max: 80000\n source: manual\n enabled: true\n\n -
id: MATERIAL_COST\n type: INTERMEDIATE\n label: \"Материальные затраты\"\n source: computed\n\n - id: UNIT_MATERIAL\n
type: INPUT\n label: \"Цена сырья за единицу\"\n value: 520\n min: 400\n max: 700\n source: manual\n enabled: true\n\n -
id: INFLATION\n type: EXTERNAL\n label: \"Инфляция\"\n value: 7.0\n min: 3\n max: 20\n source: manual\n enabled:
true\n\n - id: FX_RATE\n type: EXTERNAL\n label: \"Курс валюты\"\n value: 95.0\n min: 70\n max: 130\n source: manual\n
enabled: true\n\n - id: TARIFFS\n type: EXTERNAL\n label: \"Тарифы монополий\"\n value: 1.05\n min: 0.9\n max: 1.3\n
source: manual\n enabled: true\n\n - id: GEO_INDEX\n type: EXTERNAL\n label: \"Геополитический индекс\"\n value: 0.7\n
min: 0\n max: 1.0\n source: manual\n enabled: true\n\n - id: SUPPLIER_RISK\n type: EXTERNAL\n label: \"Риск дефолта
поставщика\"\n value: 0.05\n min: 0\n max: 1.0\n source: manual\n enabled: true\n\n - id: DIRECT_LABOR\n type:
INTERMEDIATE\n label: \"Оплата труда произв. персонала\"\n source: computed\n\n - id: PROD_HEADCOUNT\n type: INPUT\n
label: \"Численность произв. персонала\"\n value: 60\n min: 40\n max: 100\n source: manual\n enabled: true\n\n - id:
PROD_AVG_SALARY\n type: INPUT\n label: \"Средняя ЗП произв. персонала\"\n value: 58000\n min: 40000\n max: 80000\n
source: manual\n enabled: true\n\n - id: ENERGY_COST\n type: INPUT\n label: \"Энергозатраты\"\n value: 350000\n min:
200000\n max: 600000\n source: manual\n enabled: true\n\n - id: LOGISTICS_COST\n type: INPUT\n label: \"Логистика\"\n
value: 250000\n min: 100000\n max: 500000\n source: manual\n enabled: true\n\n - id: DEFECT_RATE\n type: INPUT\n label:
\"Брак\"\n value: 0.03\n min: 0.01\n max: 0.10\n source: manual\n enabled: true\n\n - id: SCALE_EFFECT\n type:
INTERMEDIATE\n label: \"Эффект масштаба\"\n source: computed\n\n - id: ADMIN_PAYROLL\n type: INTERMEDIATE\n label: \"ФОТ
АУП\"\n source: computed\n\n - id: ADMIN_HEADCOUNT\n type: INPUT\n label: \"Численность АУП\"\n value: 35\n min: 20\n
max: 60\n source: manual\n enabled: true\n\n - id: ADMIN_AVG_SALARY\n type: INPUT\n label: \"Средняя ЗП АУП\"\n value:
85000\n min: 60000\n max: 120000\n source: manual\n enabled: true\n\n - id: LABOR_INDEX\n type: EXTERNAL\n label:
\"Индекс рынка труда\"\n value: 0.8\n min: 0.5\n max: 1.5\n source: manual\n enabled: true\n\n - id: SPI\n type: INPUT\n
label: \"Индекс пирамиды зарплат\"\n value: 4.2\n min: 1.0\n max: 10.0\n source: manual\n enabled: true\n\n - id:
ATTRITION\n type: INTERMEDIATE\n label: \"Текучесть персонала\"\n source: computed\n\n - id: ENGAGEMENT\n type: INPUT\n
label: \"Вовлечённость персонала\"\n value: 0.65\n min: 0.3\n max: 1.0\n source: manual\n enabled: true\n\n - id: RENT\n
type: INPUT\n label: \"Аренда\"\n value: 350000\n min: 200000\n max: 500000\n source: manual\n enabled: true\n\n - id:
IT_EXP\n type: INPUT\n label: \"IT-расходы\"\n value: 150000\n min: 50000\n max: 300000\n source: manual\n enabled:
true\n\n - id: RD_EXP\n type: INPUT\n label: \"R&D расходы\"\n value: 100000\n min: 0\n max: 500000\n source: manual\n
enabled: true\n\n - id: TRAINING_EXP\n type: INPUT\n label: \"Обучение персонала\"\n value: 50000\n min: 0\n max:
200000\n source: manual\n enabled: true\n\n - id: FIXED_ASSETS\n type: INPUT\n label: \"Основные средства\"\n value:
12000000\n min: 5000000\n max: 30000000\n source: manual\n enabled: true\n\n - id: INTANGIBLE_ASSETS\n type: INPUT\n
label: \"Нематериальные активы\"\n value: 2000000\n min: 0\n max: 10000000\n source: manual\n enabled: true\n\n - id:
DA_RATE\n type: INPUT\n label: \"Норма амортизации\"\n value: 0.10\n min: 0.05\n max: 0.20\n source: manual\n enabled:
true\n\n - id: WEAR\n type: INTERMEDIATE\n label: \"Износ оборудования\"\n source: computed\n\n - id: CAPEX\n type:
INPUT\n label: \"Капитальные затраты\"\n value: 800000\n min: 0\n max: 3000000\n source: manual\n enabled: true\n\n -
id: CAPACITY_UTIL\n type: INPUT\n label: \"Загрузка мощностей\"\n value: 0.78\n min: 0.4\n max: 1.0\n source: manual\n
enabled: true\n\n - id: TECH_OBSOLESCENCE\n type: INPUT\n label: \"Технологическое устаревание\"\n value: 0.05\n min:
0\n max: 0.15\n source: manual\n enabled: true\n\n - id: LOANS\n type: INPUT\n label: \"Кредитный портфель\"\n value:
5000000\n min: 0\n max: 20000000\n source: manual\n enabled: true\n\n - id: LOAN_RATE\n type: INTERMEDIATE\n label:
\"Ставка по кредитам\"\n source: computed\n\n - id: BANK_SPREAD\n type: INPUT\n label: \"Спред банка\"\n value: 0.03\n
min: 0.01\n max: 0.08\n source: manual\n enabled: true\n\n - id: RATE_TYPE\n type: INPUT\n label: \"Тип ставки\"\n
value: 0\n min: 0\n max: 1\n source: manual\n enabled: true\n\n - id: CREDIT_RATING\n type: INPUT\n label: \"Кредитный
рейтинг\"\n value: 0.70\n min: 0.2\n max: 1.0\n source: manual\n enabled: true\n\n - id: DEBT_EBITDA\n type:
INTERMEDIATE\n label: \"Debt/EBITDA\"\n source: computed\n\n - id: FCF\n type: INTERMEDIATE\n label: \"Свободный
денежный поток\"\n source: computed\n\n - id: CFO\n type: INTERMEDIATE\n label: \"Операционный денежный поток\"\n
source: computed\n\n - id: CFI\n type: INTERMEDIATE\n label: \"Инвестиционный денежный поток\"\n source: computed\n\n -
id: CFF\n type: INTERMEDIATE\n label: \"Финансовый денежный поток\"\n source: computed\n\n - id: delta_RECEIVABLES\n
type: INPUT\n label: \"Изменение дебиторской задолженности\"\n value: 300000\n min: -2000000\n max: 2000000\n source:
manual\n enabled: true\n\n - id: delta_PAYABLES\n type: INPUT\n label: \"Изменение кредиторской задолженности\"\n value:
150000\n min: -1000000\n max: 1000000\n source: manual\n enabled: true\n\n - id: delta_INVENTORY\n type: INPUT\n label:
\"Изменение запасов\"\n value: 200000\n min: -2000000\n max: 2000000\n source: manual\n enabled: true\n\n - id:
NEW_LOANS\n type: INPUT\n label: \"Новые кредиты\"\n value: 0\n min: 0\n max: 10000000\n source: manual\n enabled:
true\n\n - id: LOAN_REPAYMENT\n type: INPUT\n label: \"Погашение кредитов\"\n value: 600000\n min: 0\n max: 5000000\n
source: manual\n enabled: true\n\n - id: DIVIDENDS\n type: INPUT\n label: \"Дивиденды\"\n value: 0\n min: 0\n max:
5000000\n source: manual\n enabled: true\n\n - id: CASH\n type: INTERMEDIATE\n label: \"Денежные средства\"\n source:
computed\n\n - id: INVENTORY\n type: INPUT\n label: \"Товарные запасы\"\n value: 3200000\n min: 1000000\n max: 6000000\n
source: manual\n enabled: true\n\n - id: RECEIVABLES\n type: INPUT\n label: \"Дебиторская задолженность\"\n value:
2500000\n min: 500000\n max: 5000000\n source: manual\n enabled: true\n\n - id: PAYABLES\n type: INPUT\n label:
\"Кредиторская задолженность\"\n value: 1800000\n min: 500000\n max: 3000000\n source: manual\n enabled: true\n\n - id:
CURRENT_ASSETS\n type: INTERMEDIATE\n label: \"Оборотные активы\"\n source: computed\n\n - id: ASSETS\n type:
INTERMEDIATE\n label: \"Активы\"\n source: computed\n\n - id: EQUITY\n type: INPUT\n label: \"Собственный капитал\"\n
value: 10000000\n min: 1000000\n max: 50000000\n source: manual\n enabled: true\n\n - id: RETAINED_EARNINGS\n type:
INTERMEDIATE\n label: \"Нераспределённая прибыль\"\n source: computed\n\nedges:\n - from: PRICE\n to: VOLUME\n type:
LIN\n coefficient: -0.35\n\n - from: MARKETING\n to: VOLUME\n type: DIM\n coefficient: 0.12\n\n - from: SEASON\n to:
VOLUME\n type: LIN\n coefficient: 1.0\n\n - from: BUSINESS_ACTIVITY\n to: VOLUME\n type: LIN\n coefficient: 0.08\n\n -
from: COMPETITION\n to: VOLUME\n type: LIN\n coefficient: -0.05\n\n - from: HOUSEHOLD_INCOME\n to: VOLUME\n type: LIN\n
coefficient: 0.06\n\n - from: PMI\n to: BUSINESS_ACTIVITY\n type: LIN\n coefficient: 0.015\n\n - from: CCI\n to:
BUSINESS_ACTIVITY\n type: LIN\n coefficient: 0.01\n\n - from: CB_RATE\n to: BUSINESS_ACTIVITY\n type: LIN\n coefficient:
-0.02\n\n - from: SANCTIONS\n to: BUSINESS_ACTIVITY\n type: LIN\n coefficient: -0.10\n\n - from: VOLUME\n to: REVENUE\n
type: LIN\n coefficient: 1.0\n\n - from: PRICE\n to: REVENUE\n type: LIN\n coefficient: 1.0\n\n - from: VOLUME\n to:
MATERIAL_COST\n type: LIN\n coefficient: 1.0\n\n - from: UNIT_MATERIAL\n to: MATERIAL_COST\n type: LIN\n coefficient:
1.0\n\n - from: INFLATION\n to: UNIT_MATERIAL\n type: LIN\n coefficient: 0.03\n\n - from: FX_RATE\n to: UNIT_MATERIAL\n
type: LIN\n coefficient: 0.02\n\n - from: TARIFFS\n to: UNIT_MATERIAL\n type: LIN\n coefficient: 0.05\n\n - from:
GEO_INDEX\n to: UNIT_MATERIAL\n type: LIN\n coefficient: 0.15\n\n - from: SUPPLIER_RISK\n to: UNIT_MATERIAL\n type:
THR\n threshold: 0.3\n above: 1.4\n below: 1.0\n\n - from: PROD_HEADCOUNT\n to: DIRECT_LABOR\n type: LIN\n coefficient:
1.0\n\n - from: PROD_AVG_SALARY\n to: DIRECT_LABOR\n type: LIN\n coefficient: 1.0\n\n - from: LABOR_INDEX\n to:
DIRECT_LABOR\n type: LIN\n coefficient: 0.08\n\n - from: VOLUME\n to: SCALE_EFFECT\n type: DIM\n coefficient: -0.02\n\n
- from: MATERIAL_COST\n to: COGS\n type: LIN\n coefficient: 1.0\n\n - from: DIRECT_LABOR\n to: COGS\n type: LIN\n
coefficient: 1.0\n\n - from: ENERGY_COST\n to: COGS\n type: LIN\n coefficient: 1.0\n\n - from: LOGISTICS_COST\n to:
COGS\n type: LIN\n coefficient: 1.0\n\n - from: DEFECT_RATE\n to: COGS\n type: LIN\n coefficient: 1.0\n\n - from:
SCALE_EFFECT\n to: COGS\n type: LIN\n coefficient: 1.0\n\n - from: ADMIN_HEADCOUNT\n to: ADMIN_PAYROLL\n type: LIN\n
coefficient: 1.0\n\n - from: ADMIN_AVG_SALARY\n to: ADMIN_PAYROLL\n type: LIN\n coefficient: 1.0\n\n - from:
LABOR_INDEX\n to: ADMIN_PAYROLL\n type: LIN\n coefficient: 0.05\n\n - from: ADMIN_PAYROLL\n to: ADMIN_EXP\n type: LIN\n
coefficient: 1.0\n\n - from: RENT\n to: ADMIN_EXP\n type: LIN\n coefficient: 1.0\n\n - from: IT_EXP\n to: ADMIN_EXP\n
type: LIN\n coefficient: 1.0\n\n - from: RD_EXP\n to: ADMIN_EXP\n type: LIN\n coefficient: 1.0\n\n - from:
TRAINING_EXP\n to: ADMIN_EXP\n type: LIN\n coefficient: 1.0\n\n - from: MARKETING\n to: SELLING_EXP\n type: LIN\n
coefficient: 1.0\n\n - from: LOGISTICS_COST\n to: SELLING_EXP\n type: LIN\n coefficient: 0.3\n\n - from: FIXED_ASSETS\n
to: DA\n type: LIN\n coefficient: 1.0\n\n - from: INTANGIBLE_ASSETS\n to: DA\n type: LIN\n coefficient: 1.0\n\n - from:
DA_RATE\n to: DA\n type: LIN\n coefficient: 1.0\n\n - from: CAPACITY_UTIL\n to: WEAR\n type: LIN\n coefficient: 0.05\n\n
- from: TECH_OBSOLESCENCE\n to: WEAR\n type: LIN\n coefficient: 0.02\n\n - from: CAPEX\n to: WEAR\n type: LIN\n
coefficient: -0.01\n\n - from: WEAR\n to: DA_RATE\n type: LIN\n coefficient: 0.03\n\n - from: CB_RATE\n to: LOAN_RATE\n
type: LIN\n coefficient: 1.0\n\n - from: BANK_SPREAD\n to: LOAN_RATE\n type: LIN\n coefficient: 1.0\n\n - from: LOANS\n
to: INTEREST\n type: LIN\n coefficient: 1.0\n\n - from: LOAN_RATE\n to: INTEREST\n type: LIN\n coefficient: 1.0\n\n -
from: LOANS\n to: DEBT_EBITDA\n type: LIN\n coefficient: 1.0\n\n - from: EBITDA\n to: DEBT_EBITDA\n type: LIN\n
coefficient: -0.001\n\n - from: SPI\n to: ATTRITION\n type: EXP\n coefficient: 0.04\n lag_days: 90\n\n - from:
LABOR_INDEX\n to: ATTRITION\n type: LIN\n coefficient: 0.05\n\n - from: ENGAGEMENT\n to: ATTRITION\n type: LIN\n
coefficient: -0.10\n\n - from: ATTRITION\n to: ADMIN_HEADCOUNT\n type: LIN\n coefficient: -0.3\n lag_days: 60\n\n -
from: REVENUE\n to: GROSS_PROFIT\n type: LIN\n coefficient: 1.0\n\n - from: COGS\n to: GROSS_PROFIT\n type: LIN\n
coefficient: -1.0\n\n - from: GROSS_PROFIT\n to: EBITDA\n type: LIN\n coefficient: 1.0\n\n - from: SELLING_EXP\n to:
EBITDA\n type: LIN\n coefficient: -1.0\n\n - from: ADMIN_EXP\n to: EBITDA\n type: LIN\n coefficient: -1.0\n\n - from:
EBITDA\n to: EBIT\n type: LIN\n coefficient: 1.0\n\n - from: DA\n to: EBIT\n type: LIN\n coefficient: -1.0\n\n - from:
EBIT\n to: EBT\n type: LIN\n coefficient: 1.0\n\n - from: INTEREST\n to: EBT\n type: LIN\n coefficient: -1.0\n\n - from:
INTEREST_INCOME\n to: EBT\n type: LIN\n coefficient: 1.0\n\n - from: OTHER_INCOME\n to: EBT\n type: LIN\n coefficient:
1.0\n\n - from: OTHER_EXP\n to: EBT\n type: LIN\n coefficient: -1.0\n\n - from: PENALTIES\n to: EBT\n type: LIN\n
coefficient: -1.0\n\n - from: EBT\n to: NET_PROFIT\n type: LIN\n coefficient: 1.0\n\n - from: TAX\n to: NET_PROFIT\n
type: LIN\n coefficient: -1.0\n\n - from: EBT\n to: TAX\n type: LIN\n coefficient: 1.0\n\n - from: TAX_RATE\n to: TAX\n
type: LIN\n coefficient: 1.0\n\n - from: NET_PROFIT\n to: CFO\n type: LIN\n coefficient: 1.0\n\n - from: DA\n to: CFO\n
type: LIN\n coefficient: 1.0\n\n - from: delta_RECEIVABLES\n to: CFO\n type: LIN\n coefficient: -1.0\n\n - from:
delta_PAYABLES\n to: CFO\n type: LIN\n coefficient: 1.0\n\n - from: delta_INVENTORY\n to: CFO\n type: LIN\n coefficient:
-1.0\n\n - from: CAPEX\n to: CFI\n type: LIN\n coefficient: -1.0\n\n - from: NEW_LOANS\n to: CFF\n type: LIN\n
coefficient: 1.0\n\n - from: LOAN_REPAYMENT\n to: CFF\n type: LIN\n coefficient: -1.0\n\n - from: DIVIDENDS\n to: CFF\n
type: LIN\n coefficient: -1.0\n\n - from: CFO\n to: FCF\n type: LIN\n coefficient: 1.0\n\n - from: CFI\n to: FCF\n type:
LIN\n coefficient: 1.0\n\n - from: CFF\n to: FCF\n type: LIN\n coefficient: 1.0\n\n - from: INVENTORY\n to:
CURRENT_ASSETS\n type: LIN\n coefficient: 1.0\n\n - from: RECEIVABLES\n to: CURRENT_ASSETS\n type: LIN\n coefficient:
1.0\n\n - from: CASH\n to: CURRENT_ASSETS\n type: LIN\n coefficient: 1.0\n\n - from: CURRENT_ASSETS\n to: ASSETS\n type:
LIN\n coefficient: 1.0\n\n - from: FIXED_ASSETS\n to: ASSETS\n type: LIN\n coefficient: 1.0\n\n - from:
INTANGIBLE_ASSETS\n to: ASSETS\n type: LIN\n coefficient: 1.0\n\n - from: NET_PROFIT\n to: RETAINED_EARNINGS\n type:
LIN\n coefficient: 1.0\n\n - from: DIVIDENDS\n to: RETAINED_EARNINGS\n type: LIN\n coefficient: -1.0\n\n - from: FCF\n
to: CASH\n type: LIN\n coefficient: 1.0\n\n - from: CASH\n to: CASH\n type: LIN\n coefficient: 1.0\n lag_days:
365\n\nconstraints:\n - node: NET_PROFIT\n operator: \">=\"\n value: 0\n\n - node: NET_PROFIT\n operator: \">=\"\n
value: 1000000";
