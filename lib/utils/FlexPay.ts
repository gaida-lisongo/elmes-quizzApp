export interface FlexPayProps {
    type: 'card' | 'mobile' | 'whithdraw',
    phone: string,
    reference: string,
    currency: string,
    amount: number
}

export interface FlexPayInitResponse {
    success: boolean;
    orderNumber?: string;
    url?: string;
    message?: string;
    error?: string;
    raw?: any;
}

const IN = {
    merchant: process.env.FLEX_IN || '',
    token: process.env.FLEX_TOKEN || '',
    mobile: process.env.FLEX_MOBILE || '',
    card: process.env.FLEX_CARD || '',
    check: process.env.FLEX_CHECKIN || ''
};

const OUT = {
    host: process.env.FLEX_AUTH || '',
    user: process.env.FLEX_OUT || '',
    secret: process.env.FLEX_LOGIN || '',
    check: process.env.FLEX_CHECKOUT || '',
    balance: process.env.FLEX_BALANCE || ''
}

const SERVER = process.env.HOST || 'http://localhost:3000/';
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || process.env.APP_URL || SERVER;

class FlexPay {
    orderNumber: string = "";
    url: string = "";
    error: {status: string, message: string, info?: any} = { status: "", message: "" };

    constructor(payload?: FlexPayProps){
        if (!payload) return;

        const { type, phone = '', reference, currency, amount } = payload;
        void this.init(type, phone, reference, currency, amount);
    }

    async init(type: FlexPayProps["type"], phone: string, reference: string, currency: string, amount: number) {
        switch (type) {
            case 'card':
                return this.initCard(phone, reference, currency, amount);
            case 'whithdraw':
                return this.initWithdraw(phone, reference, currency, amount);
            default:
                return this.initMobile(phone, reference, currency, amount);
        }
    }

    async initCard(phone: string, ref: string, currency: string, amount: number): Promise<FlexPayInitResponse>{
        try {
            const req = await fetch(`${IN.card}`, {
                method: "POST",
                headers :{
                    "Content-Type": "application/json",
                    "Authorization": `${IN.token}`
                },
                body: JSON.stringify({
                    authorization:`${IN.token}`,
                    merchant:`${IN.merchant}`,
                    reference:'test', //ref
                    amount:amount * 2,
                    currency:currency,
                    language:"fr",
                    description:`[ELMES-QUIZ] Phone: ${phone}`,
                    callback_url:`${SERVER.replace(/\/$/, "")}/api/flexpay`,
                    approve_url:`${APP_URL.replace(/\/$/, "")}/payment/verification?type=callback-flexpay&status=approve&orderNumber=${encodeURIComponent(ref)}`,
                    cancel_url:`${APP_URL.replace(/\/$/, "")}/payment/verification?type=callback-flexpay&status=cancel&orderNumber=${encodeURIComponent(ref)}`,
                    decline_url:`${APP_URL.replace(/\/$/, "")}/payment/verification?type=callback-flexpay&status=decline&orderNumber=${encodeURIComponent(ref)}`,
                })
            });

            const data = await req.json();
            const {code, message, orderNumber, url} = data;
            const normalizedCode = String(code ?? "");
            const success = normalizedCode === "0" || normalizedCode !== "1";

            if(success && orderNumber && url){
                this.orderNumber = orderNumber;
                this.url = url
                return {
                    success: true,
                    orderNumber,
                    url,
                    message: message || "Paiement carte initie.",
                    raw: data,
                };
            } else {
                this.error.message = message;
                this.error.status = normalizedCode;
                return {
                    success: false,
                    error: message || "Echec de l'initiation du paiement carte.",
                    raw: data,
                };
            }

        } catch (error: any) {
            console.error('[CARD PAYMENT ERROR]', error);
            this.error.info = error;
            this.error.message = '[CARD PAYMENT ERROR]';
            this.error.status = '1';
            return {
                success: false,
                error: error.message || '[CARD PAYMENT ERROR]',
            };
        }
    }

    async processTransaction(payload: any, cb: (data :any) => void){
        try {
            console.log("[PROCESS TRANSACTION]", payload)
            cb(payload)
        } catch (error: any) {
            console.error('[PROCESS TRANSACTION ERROR]', error);
            return { sucess: false, message: error?.msg, data : null}
        }
    }

    async initWithdraw(phone: string, ref: string, currency: string, amount: number){
        //Authentification User

        //Verification Balance

        //Transaction

    }

    async checkPayment(orderNumber: string){
        const req = await fetch(`${IN.check}/${orderNumber}`, {
            method: 'GET',
            headers :{
                "Content-Type": "application/json",
                "Authorization": `${IN.token}`
            },
        });

        const {code, message, transaction} = await req.json();

        return {
            sucess: transaction?.status != 1,
            message,
            data: {
                ...transaction
            }
        }
    }

    async initMobile(phone: string, ref: string, currency: string, amount: number){
        //
    }

}

export default FlexPay;
