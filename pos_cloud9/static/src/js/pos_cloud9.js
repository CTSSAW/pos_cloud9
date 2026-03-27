odoo.define('pos_cloud9.pos_cloud9', function (require) {
    "use strict";
    
var pos_model = require('point_of_sale.models');

// pos_model.PosModel = pos_model.PosModel.extend({
//      tipAmt : string,
// });

var _paylineproto = pos_model.Paymentline.prototype;
pos_model.Paymentline = pos_model.Paymentline.extend({
    init_from_JSON: function (json) {
        _paylineproto.init_from_JSON.apply(this, arguments);
        this.cloud9_medium = json.cloud9_medium;
        this.cloud9_brand = json.cloud9_brand;
        this.cloud9_authcode = json.cloud9_authcode;
        this.cloud9_cardnumber = json.cloud9_cardnumber;
        this.cloud9_responseCode = json.cloud9_responseCode;
    },
    export_as_JSON: function () {
        return _.extend(_paylineproto.export_as_JSON.apply(this, arguments), {
            cloud9_medium: this.cloud9_medium,
            cloud9_brand: this.cloud9_brand,
            cloud9_authcode: this.cloud9_authcode,
            cloud9_cardnumber: this.cloud9_cardnumber,
            cloud9_responseCode: this.cloud9_responseCode});
    },

    export_for_printing: function () {
        const result = _paylineproto.export_for_printing.apply(this, arguments);
        result.cloud9_medium = this.cloud9_medium;
        result.cloud9_brand = this.cloud9_brand;
        result.cloud9_authcode = this.cloud9_authcode;
        result.cloud9_cardnumber = this.cloud9_cardnumber;
        result.cloud9_responseCode = this.cloud9_responseCode;
        return result;
    }
});

});
