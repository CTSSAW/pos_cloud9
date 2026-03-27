# -*- coding: utf-8 -*-
{
    'name': 'Cloud9 POS Payment Gateway (Odoo Community Compatible)',
    'version': '18.0.1.0.0',
    'category': 'Sales/Point of Sale',
    'summary': 'POS Payment Gateway — Bring your processor or let us help you choose (Community & Enterprise). Elavon, TSYS, Global, Nuvei, and more',
    'description': 'Cloud9 Payment Gateway integration for Odoo POS. Accept payments, run tabs, and support multiple processors. Fully compatible with Odoo Community and Enterprise editions. Ideal for clubs, restaurants, and multi-terminal environments.',
    'author': 'C9PG',
    'website': 'https://c9pg.com',
    'license': 'LGPL-3',
    'live_test_url': 'https://c9pg.com/demo',
    'data': [
        'views/pos_payment_method_views.xml',
        'views/res_config_settings_views.xml',
    ],
    'depends': ['point_of_sale'],
    'installable': True,
    'auto_install': False,
    'assets': {
        'point_of_sale.assets': [
            'pos_cloud9/static/src/js/payment_cloud9.js',
            'pos_cloud9/static/src/js/models.js',
            'pos_cloud9/static/src/js/pos_cloud9.js',
        ],
        'web.assets_qweb': [
            'pos_cloud9/static/src/xml/**/*.xml',
        ],
    },
    'images': [
        'static/description/thumbnail.png',
        'static/description/main_dashboard.png',
        'static/description/member_portal.png',
    ],
}
