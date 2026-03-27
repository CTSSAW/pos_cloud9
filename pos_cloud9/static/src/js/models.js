odoo.define('pos_cloud9.models', function (require) {
var models = require('point_of_sale.models');
var PaymentCloud9 = require('pos_cloud9.payment');

models.register_payment_method('cloud9', PaymentCloud9);
});
