const axios = require('axios')
const qs = require('qs')
const fs = require('fs')

const log4js = require('log4js')
const logger = log4js.getLogger()
logger.level = 'debug'

const client = axios.create({
    headers: {'User-Agent': 'Mozilla/5.0 (iPhone CPU iPhone OS 10_3 like Mac OS X) AppleWebKit/602.1.50 (KHTML, like Gecko) CriOS/56.0.2924.75 Mobile/14E5239e Safari/602.1',
              'Content-Type': 'application/x-www-form-urlencoded'
             }
})

const checkoutEndpoint = 'https://www.supremenewyork.com/checkout.json'

const encodeVariants = (variants) => {
    let varObj = {}
    variants.forEach(v => varObj[v] = 1)
    return encodeURIComponent(JSON.stringify(varObj).replace(/'/g, '"'))
}

const checkoutVariants = (profile, variants) => {
    const checkoutData = {
        'store_credit_id': '',
        'from_mobile': '1',
        'cookie-sub': encodeVariants(variants),
        'same_as_billing_address': '1',
        'order[billing_name]': profile['billing_name'],
        'order[email]': profile['email'],
        'order[tel]': profile['tel'],
        'order[billing_address]': profile['billing_address'],
        'order[billing_address_2]': profile['billing_address_2'],
        'order[billing_zip]': profile['billing_zip'],
        'order[billing_city]': profile['billing_city'],
        'order[billing_state]': profile['billing_state'],
        'order[billing_country]': profile['billing_country'],
        'credit_card[cnb]': profile['card_cnb'],
        'credit_card[month]': profile['card_month'],
        'credit_card[year]': profile['card_year'],
        'credit_card[rsusr]': profile['card_cvv'],
        'order[terms]': '1'
    }

    return client.post(checkoutEndpoint, qs.stringify(checkoutData)).then(res => {
        return res.data
    }).catch(err => {
        return err
    })
}

const exampleProfile = {
    'billing_name': 'Riley Brown',
    'email': 'someguy@gmail.com',
    'tel': '347-123-2000',
    'billing_address': 'Forest Street 58',
    'billing_address_2': 'Apt 2A',
    'billing_zip': '10101',
    'billing_city': 'New York City',
    'billing_state': 'NY',
    'billing_country': 'USA',
    'card_cnb': '4424 9068 7255 8398',
    'card_month': '01',
    'card_year': '2020',
    'card_cvv': '232',
    'variants': ["1000", "20000"]
}

const checkStatus = (slug) => {
    axios.get(`https://www.supremenewyork.com/checkout/${slug}/status.json`).then(res => {
        if(res.data.status === 'queued') {
            logger.info('In queue.. Checking again in 1s')
            setTimeout(() => checkStatus(slug), 1000)
        } else if(res.data.status === 'failed') {
            logger.fatal('Couldn\'t checkout successfully :(')
        } else {
            logger.info(res.data)
        }
    }).catch(err => {
        return err
    })
}

const checkoutItems = (profile, variants) => {
    logger.info(`Attempting to checkout with variants: ${variants}`)
    checkoutVariants(profile, variants).then(res => {
        if(res.status === 'failed') {
            logger.fatal('Failed to checkout')
        } else if(res.status === 'outOfStock') {
            logger.warn('Item is out of stock.. Trying again in 1s')
            setTimeout(() => checkoutItems(profile, variants), 1000)
        } else if(res.status === 'queued') {
            logger.info('In queue!')
            checkStatus(res.slug)
        }
    })
}


(() => {
    const profile = JSON.parse(fs.readFileSync('config.json'))
    logger.info('Parsed config.json! Deleting it from disk.')
    fs.unlinkSync('config.json')
    if(profile) {
        checkoutItems(profile, profile['variants'])
    }
})()