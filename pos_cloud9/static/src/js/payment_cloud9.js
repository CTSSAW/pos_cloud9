odoo.define('pos_cloud9.payment', function (require) {
    "use strict";

    var core = require('web.core');
    var rpc = require('web.rpc');
    var models = require('point_of_sale.models');
    var PaymentInterface = require('point_of_sale.PaymentInterface');
    const { Gui } = require('point_of_sale.Gui');

    var _t = core._t;

    var PaymentCloud9 = PaymentInterface.extend({
        init: function (pos, payment_method) {
            this._super.apply(this, arguments);
            this.enable_reversals(); //enable reverse
        },

        send_payment_request: function (cid) {
            this._super.apply(this, arguments);
            return this._cloud9_pay(cid);
        },

        send_payment_cancel: function (order, cid) {
            this._super.apply(this, arguments);
            // set only if we are polling
            this.was_cancelled = !!this.polling;
            var order = this.pos.get_order();
            var line = order.get_paymentline(cid);
            if(line.transaction_id){
                return this._cloud9_reverse(cid);
            }else{
                return Promise.resolve(true);
            }            
        },

        
        send_payment_reversal: function (cid) {
            this._super.apply(this, arguments);
            return this._cloud9_reverse(cid);
        },


        close: function () {
            this._super.apply(this, arguments);
        },

        // private methods
        _cloud9_pay: function (cid) {
            var self = this;
            var order = this.pos.get_order();
            var line = order.get_paymentline(cid);

            // if (line.amount < 0) {
            //     this._show_error(_t('Cannot process transactions with negative amount.'));
            //     return Promise.resolve();
            // }

            var data = this._cloud9_pay_data(line);

            return this._call_cloud9(data).then(function (data) {
                return self._cloud9_handle_sale_response(line, data);
            });
        },

        _cloud9_reverse: function (cid) {
            var self = this;
            var order = this.pos.get_order();
            var line = order.get_paymentline(cid);

            if (line.amount < 0) {
                this._show_error(_t('Cannot process transactions with negative amount.'));
                return Promise.resolve();
            }

            var data = {                    
                'MainAmt': "0",
                'GTRC': line.transaction_id,
                'Currency': this.pos.currency.name,                
                'TransType': 'Void',
            };

            return this._call_cloud9(data).then(function (data) {
                return self._cloud9_handle_void_response(line,data);
            });
        },

        _cloud9_pay_data: function (line) {
            var order = this.pos.get_order();
            var data = {
                // "GMID": "1001406517",
                // "GTID": "GT1001406520",
                // "GMPW": "GMPW3010020661",
                // "NeedSwipeCard": "N",
                // 'Medium': 'Credit',
                // 'TipAmt': '100',
                // "EntryMode": "MANUAL",
                // "AccountNum": "3528000000000072",
                // "ExpDate": "0526",
                'MainAmt': Math.abs(line.amount), // when refund, amount is negative
                'Currency': this.pos.currency.name,                
                'TransType': line.amount < 0 ? 'refund':'Sale',
                'InvoiceNum': order.uid.replace(/-/g,''), //drop '-' char
            };
            return data;
        },

        _call_cloud9: function (data, operation) {
            return rpc.query({
                model: 'pos.payment.method',
                method: 'proxy_cloud9_request',
                args: [[this.payment_method.id], data, operation],
            }, {
                // When a payment terminal is disconnected it takes Adyen
                // a while to return an error (~6s). So wait 10 seconds
                // before concluding Odoo is unreachable.
                timeout: 65000,
                shadow: true,
            }).catch(this._handle_odoo_connection_failure.bind(this));

            // var promise = new Promise(function (resolved, rejected) {
            //     var httpRequest = new XMLHttpRequest();
            //     httpRequest.open("Post", "https://qalink.c9pg.com:11911/restApi");
            //     httpRequest.send(data);
            //     httpRequest.onreadystatechange = function () {
            //         if (httpRequest.readyState === 4 && httpRequest.status === 200) {
            //             var jason = JSON.parse(httpRequest.responseText);
            //             console.log(jason);
            //             resolved(jason);   //告诉promise成功了
            //         }
            //     }
            //     setTimeout(function () {//60秒后请求不到
            //         rejected('error')  //告诉promise失败了
            //     }, 1000 * 60)
            // })
            // return promise;
        },

        _handle_odoo_connection_failure: function (data) {
            // handle timeout
            var order = this.pos.get_order();
            if (order) {
                var line = order.selected_paymentline;
                if (line) {
                    line.set_payment_status('retry');
                }
            }else{
                console.log("order is null");
            }
            this._show_error(_t('Could not connect to the Odoo server, please check your internet connection and try again.'));

            return Promise.reject(data); // prevent subsequent onFullFilled's from being called
        },

        _cloud9_handle_sale_response: function (line,response) {
            var order = this.pos.get_order();
            //var line = order.selected_paymentline;
            if ("success" == response.Status) {
                //line.set_receipt_info(this._convert_receipt_info(response));
                var tip_amount = response["TipAmt"];
                if(tip_amount>0){
                    order.set_tip(tip_amount*0.01);                    
                }else if(response["AuthAmt"]>0 && response["AuthAmt"] > order.get_total_with_tax()*100){
                    order.set_tip((response["AuthAmt"]*0.01-order.get_total_with_tax()));
                }
                if(response["AuthAmt"]>0){
                    line.set_amount(response["AuthAmt"]*0.01);
                }
                this._save_receipt_info(line,response);
                line.transaction_id = response.GTRC;
                line.card_type = response.Brand;
                order.trigger('change', order); // needed so that export_to_JSON gets triggered
                return Promise.resolve(true);
            } else {
                var message = response.ErrorText;
                this._show_error(_.str.sprintf(_t('Message from Cloud9: %s'), message));
                // this means the transaction was cancelled by pressing the cancel button on the device
                line.set_payment_status('retry');
                return Promise.resolve(false);
            }
        },

        _cloud9_handle_void_response: function (line,response) {
            var order = this.pos.get_order();
            //var line = order.selected_paymentline;
            if ("success" == response.Status) {
                order.trigger('change', order); // needed so that export_to_JSON gets triggered
                return Promise.resolve(true);
            } else {
                var message = response.ErrorText;
                this._show_error(_.str.sprintf(_t('Message from Cloud9: %s'), message));
                // this means the transaction was cancelled by pressing the cancel button on the device
                line.set_payment_status('retry');
                return Promise.resolve(false);
            }
        },

        _show_error: function (msg, title) {
            if (!title) {
                title = _t('Cloud9 Error');
            }
            Gui.showPopup('ErrorPopup', {
                'title': title,
                'body': msg,
            });
        },

        _save_receipt_info: function (line,output_text) {
            line.cloud9_authcode = output_text["AuthCode"];
            line.cloud9_medium = output_text["Medium"];
            line.cloud9_brand = output_text["Brand"];
            line.cloud9_cardnumber = output_text["AccountNum"];
            line.cloud9_responseCode = output_text["ResponseCode"];
        },

        _convert_receipt_info: function (output_text) {
            var writelist = ["Medium","Brand","AuthCode","AccountNum","ResultText"];
            var value = "";
            for(var i=0,len = writelist.length; i<len;i++){
                var tmp = _.str.sprintf('<br/>%s:       %s', writelist[i], output_text[writelist[i]]);
                // "<div class='pos-receipt'><div class='pos-payment-terminal-receipt'>" +
                // tmp +"</div></div>";
                value += tmp;
            }                
            return value;
            // return output_text.reduce(function (acc, entry) {
            //     var params = new URLSearchParams(entry.Text);

            //     if (params.get('name') && !params.get('value')) {
            //         return acc + _.str.sprintf('<br/>%s', params.get('name'));
            //     } else if (params.get('name') && params.get('value')) {
            //         return acc + _.str.sprintf('<br/>%s: %s', params.get('name'), params.get('value'));
            //     }

            //     return acc;
            // }, '');
        },
    });

    return PaymentCloud9;
});
