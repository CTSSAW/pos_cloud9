# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import api, fields, models, _


class ResConfigSettings(models.TransientModel):
    _inherit = "res.config.settings"
    module_pos_cloud9 = fields.Boolean(string="Cloud9 Payment Terminal", help="The transactions are processed by Cloud9. Set your Cloud9 credentials on the related payment method.")

 