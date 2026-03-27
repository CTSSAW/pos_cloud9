# coding: utf-8
# Part of Odoo. See LICENSE file for full copyright and licensing details.
import json
import logging
from os import terminal_size
import pprint
import random
import requests
import string
from werkzeug.exceptions import Forbidden
import re

from odoo import fields, models, api, _
from odoo.exceptions import ValidationError

_logger = logging.getLogger(__name__)

class PosPaymentMethod(models.Model):
    _inherit = 'pos.payment.method'

    def _get_payment_terminal_selection(self):
        return super(PosPaymentMethod, self)._get_payment_terminal_selection() + [('cloud9', 'Cloud9')]

    cloud9_gmid = fields.Char(string="GMID", copy=False)
    cloud9_gtid = fields.Char(string="GTID", copy=False)
    terminale_type = fields.Selection([
        ('/QuickChip/Ingenico', 'Ingenico'),
        ('/QuickChip/Pax', 'Pax'),
        ('/QuickChip/Dejavoo', 'Dejavoo'),
        ('/restPDC/WINPDC', 'WinPDC')],
        string="Terminal Type",
        required=True, default='/QuickChip/Ingenico',
        help="The PINPad terminal type which is used to accept credit card.") 
    
    enable_tips = fields.Boolean(string="Enable Tips", copy=False, help="Enable device accept tip amount enter.")
    tip_format = fields.Selection([
        ('tip_percent', 'Percent'),
        ('tip_amount', 'Amount'),
        ],
        string="Format",
        required=True, 
        default='tip_percent',
        help="Device displays tip amount format."
    )
    tip_percent = fields.Char(string="Percent", default='10%,20%,30%', help="Please set the tip percentage strictly with reference to the default data format.")
    tip_amount = fields.Char(string="Amount", default='$10.00,$20.00,$30.00', help="Please set the tip amount strictly with reference to the default data format.")

    @api.constrains('cloud9_gmid')
    def _check_cloud9_terminal_identifier(self):
        for payment_method in self:
            if not payment_method.cloud9_gmid:
                continue
            if len(payment_method.cloud9_gmid) < 6:
                raise ValidationError(_('GMID:%s length incorrect.')
                                      % (payment_method.cloud9_gmid))

    @api.constrains('tip_percent')
    def _check_cloud9_tip_percent(self):
        for payment_method in self:
            if not payment_method.tip_percent:
                continue
            if None == re.match('^([1-9]\d?%,){2}[1-9]\d?%$',payment_method.tip_percent):
                raise ValidationError(_('Percent:%s format incorrect. example:10%%,20%%,30%%')
                                      % (payment_method.tip_percent))
                                      
    @api.constrains('tip_amount')
    def _check_cloud9_tip_amount(self):
        for payment_method in self:
            if not payment_method.tip_amount:
                continue
            if None == re.match('(\$(([1-9]\d{0,3})|[0-9])\.\d{2},){2}\$(([1-9]\d{0,3})|[0-9])\.\d{2}$',payment_method.tip_amount):
                raise ValidationError(_('Amount:%s format incorrect. example:$10.00,$20.00,$30.00')
                                      % (payment_method.tip_amount))

    def proxy_cloud9_request(self, data, operation=False):
        ''' Necessary because Adyen's endpoints don't have CORS enabled '''
        return self._proxy_cloud9_request_direct(data, operation)

    def _proxy_cloud9_request_direct(self, data, operation):
        self.ensure_one()
        TIMEOUT = 60

        data["GMID"] = self.cloud9_gmid
        data["GTID"] = self.cloud9_gtid
        data["Medium"] = "Credit"
        data["MainAmt"] = str(int(data["MainAmt"] * 100))

        if self.enable_tips and "Sale"== data["TransType"]:
            tip_format = ''
            tip_rate = ''
            if(self.tip_format == "tip_percent"):
                tip_format = 'P'
                tip_rate = self.tip_percent.replace("%", "").replace(" ", "")
            else:
                tip_format = 'A'
                tip_rate = self.tip_amount.replace("$", "").replace(" ", "").replace(".", "")                
            data["TipAmountPromptFormat"] = tip_format
            data["RequestTipAmount"] = "Y"
            data["TipAmountRate"] = tip_rate

        _logger.info('request to cloud9\n%s', pprint.pformat(data))

        endpoint = "https://link.c9pg.com:11911"
        endpoint += self.terminale_type 

        headers = {'Content-Type': 'application/json'}

        req = requests.post(endpoint, json=data, timeout=TIMEOUT)

        # Authentication error doesn't return JSON
        if req.status_code == 401:
            return {
                'error': {
                    'status_code': req.status_code,
                    'message': req.text
                }
            }

        _logger.info('receive from cloud9\n%s', pprint.pformat(req.json()))

        return req.json()
