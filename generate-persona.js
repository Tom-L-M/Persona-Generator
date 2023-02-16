const rl = require('readline').createInterface({ input: process.stdin, output: process.stdout });
const crypto = require('crypto');
const https = require('https');
const fs = require('fs')

rl.on('SIGINT', () => { rl.question('Exit (y or n)? ', (input) => { if (input.match(/^y(es)?$/i)) { rl.pause(); process.exit(0); } }); });
rl.on('SIGTERM', () => { rl.question('Exit (y or n)? ', (input) => { if (input.match(/^y(es)?$/i)) { rl.pause(); process.exit(0); } }); });

const question = (quest) => {
    return new Promise((resolve, reject) => {
        rl.question(quest, (answer) => resolve(answer.trim().toUpperCase()));
    });
}

async function fetch(url, data) {
    const dataString = (typeof data === 'string') ? data : JSON.stringify(data);
    const options = {
        method: 'POST',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'Content-Length': dataString.length,
        },
        timeout: 7000 // in ms
    }
    return new Promise((resolve, reject) => {
        const req = https.request(url, options, (res) => {
            if (res.statusCode < 200 || res.statusCode > 299) {
                return reject(new Error(`HTTP status code ${res.statusCode}`));
            }
            const body = [];
            res.on('data', (chunk) => body.push(chunk));
            res.on('end', () => { resolve(Buffer.concat(body).toString()); });
        });
        req.on('error', (err) => { reject(err); });
        req.on('timeout', () => { req.destroy(); reject(new Error('Request time out')); });
        req.write(dataString);
        req.end();
    });
}

class ProgressBar {
    constructor(total, str_left = '■', str_right = ' '){
        this.str_left = str_left;
        this.str_right = str_right;
        this.total = total;
        this.current = 0;
        this.strtotal = 60;//progress bar width.
        this.ended = false;
    }
    update (current) {
        this.current++;
        if (current) this.current = current;    
        let dots = this.str_left.repeat(parseInt((this.current % this.total) / this.total * this.strtotal));
        let left = this.strtotal - parseInt((this.current % this.total) / this.total * this.strtotal);
        let empty = this.str_right.repeat(left);
        process.stdout.write(`\r[${dots}${empty}] ${parseInt(this.current/this.total * 100)}%`);
        if (this.total <= this.current) { 
            process.stdout.write(`\r[${this.str_left.repeat(this.strtotal)}] 100%`);
            return this.ended = true; 
        }
    } 
    reset () {
        this.current = 0;
        this.ended = false;
    }  
}

const sleep = function sleep(ms) { return new Promise((resolve) => { setTimeout(resolve, ms); }); }
const stripHTML = (string, replacement = '') => string.replace(/<(?:.|\n)*?>/gm, replacement).replace(/\s+/g, ' ').trim()

const fetchLink = 'https://www.4devs.com.br/ferramentas_online.php';
const progress = new ProgressBar(10);

const main = async () => {
    const genderMap = { 'M':'H', 'F':'M' };
    const stateMap = ['AC','AL','AP','AM','BA','CE','ES','GO','MA','MT','MS','MG','PA','PB','PR','PE','PI','RJ','RN','RS','RO','RR','SC','SP','SE','TO','DF'];
    const bankMap = { 'B':2, 'R':121, 'C':85, 'I':120, 'S':151 };
    const cardMap = { 'V':'visa16', 'M':'master', 'A':'amex', 'D':'diners', 'H':'hiper' };
    const binaryRandom = () => (Math.random()>0.5);
    let temp = {}, fetched = {};

    console.log(`Populating basic information (leave blank for randomization): `);
    let gender = await question('> Select gender (US-ID standard) ([m]:male [f]:female):    ');
    let age = await question('> Inform target age:    ');
    let state = await question('> Select State (ex: sp, rj, df, go, ...):    ');
    let bank = await question('> Select bank ([b]:Banco do Brasil [r]:Bradesco [c]:Citibank [i]:Itaú [s]:Santander):    ');
    let creditCard = await question('> Select credit card ([v]:Visa [m]:MasterCard [a]:American Express [d]:DinersClub [h]:HiperCard):    ');
    let isMarried = await question('> Married? ([y]:yes [n]:no):    ');
    let isDeceased = await question('> Deceased? ([y]:yes [n]:no):    ');
    let isDriver = await question('> Driver? ([y]:yes [n]:no):    ');
    console.log('');

    temp.gender = (genderMap[gender] !== undefined ? genderMap[gender] : 'I');
    temp.age = (Number(age) < 100 && Number(age) > 1) ? Number(age) : '';
    temp.state = stateMap.includes(state) ? state : 'SP';
    temp.bank = (bankMap[bank] !== undefined ? bankMap[bank] : '');
    temp.creditCard = (cardMap[creditCard] || cardMap['V']);
    temp.isMarried = isMarried === 'Y' ? true : isMarried === 'N' ? false : binaryRandom();
    temp.isDeceased = isDeceased === 'Y' ? true : isDeceased === 'N' ? false : binaryRandom();
    temp.isDriver = isDriver === 'Y' ? true : isDriver === 'N' ? false : binaryRandom();

    process.stdout.write('\r[v] Namespace created                                                \n');
    fetched = [...JSON.parse(await fetch(fetchLink, 
        `acao=gerar_pessoa&sexo=${temp.gender}&pontuacao=S&`+
        `idade=${temp.age}&cep_estado=${temp.state}&txt_qtde=1&cep_cidade=`
    ))][0];
    process.stdout.write('\r[v] Fetched base image                                               \n');
    progress.update();
    await sleep(500);

    fetched.birthCertificate = await fetch(fetchLink,
        `acao=gerador_certidao&pontuacao=S&tipo_certidao=nascimento`
    );
    process.stdout.write('\r[v] Fetched birth certificate data                                   \n');
    progress.update();
    await sleep(500)

    fetched.electionCertificate = await fetch(fetchLink,
        `acao=gerar_titulo_eleitor&estado=${temp.state}`
    );
    process.stdout.write('\r[v] Fetched election certificate data                                \n');
    progress.update();
    await sleep(500)

    fetched.bank = await fetch(fetchLink,
        `acao=gerar_conta_bancaria&estado=${temp.state}&banco=${temp.bank}`
    ); 
    fetched.bank = stripHTML(fetched.bank).split(' ');
    fetched.bank = {
        'account': fetched.bank.slice(2,3).join(' '),
        'agency': fetched.bank.slice(4,5).join(' '),
        'company': fetched.bank.slice(
            fetched.bank.indexOf('Banco')+1,
            fetched.bank.indexOf('Cidade')
        ).join(' '),
        'city': fetched.bank.slice(
            fetched.bank.indexOf('Cidade')+1,
            fetched.bank.indexOf('Estado')
        ).join(' '),
        'state': fetched.bank.slice(
            fetched.bank.indexOf('Estado')+1,
            fetched.bank.indexOf('Clique')
        ).join(' ')
    }
    process.stdout.write('\r[v] Fetched bank account data                                        \n');
    progress.update();
    await sleep(500)

    fetched.creditCard = await fetch(fetchLink,
        `acao=gerar_cc&pontuacao=S&bandeira=${temp.creditCard}`
    );
    fetched.creditCard = stripHTML(fetched.creditCard).split(' ');
    fetched.creditCard = {
        'number': fetched.creditCard.slice(3,7).join(' '),
        'expiration': fetched.creditCard.slice(10,11).join(' '),
        'cvv': fetched.creditCard.slice(14,15).join(' ')
    } //formatting credit card response data:
    process.stdout.write('\r[v] Fetched credit card data                                         \n');
    progress.update();
    await sleep(500)
 
    if (temp.isMarried) {
        fetched.marriageCertificate = await fetch(fetchLink,
            `acao=gerador_certidao&pontuacao=S&tipo_certidao=casamento`
        );
        process.stdout.write('\r[v] Fetched marriage certificate data                                \n');
    }
    progress.update();
    await sleep(500)

    if (temp.isDeceased) {
        fetched.deceaseCertificate = await fetch(fetchLink,
            `acao=gerador_certidao&pontuacao=S&tipo_certidao=obito`
        );
        process.stdout.write('\r[v] Fetched decease certificate data                                 \n');
    }
    progress.update();
    await sleep(500)

    if (temp.isDriver) {
        fetched.driverLicense = await fetch(fetchLink,
            `acao=gerar_cnh`
        );
        process.stdout.write('\r[v] Fetched driver license data                                      \n');
        progress.update();
        await sleep(500);

        // fetched.car = await fetch(fetchLink,
        //     `acao=gerar_veiculo&pontuacao=S&estado=${temp.state}&fipe_codigo_marca=`  
        // );
        // fetched.car = stripHTML(fetched.car);
        process.stdout.write('\r[v] Fetched legal vehicle data                                       \n');
        progress.update();
        await sleep(500)
    } else {
        progress.update();
        await sleep(500)
        progress.update();
        await sleep(500)
    }

    process.stdout.write('\r[ ] Generating profile hash...                                       ');
    fetched.profileHash = (() => {
        let hash = crypto.createHash('sha256');
        hash.update(JSON.stringify(fetched));
        return hash.digest('hex');
    })();
    process.stdout.write('\r[v] Generated profile hash                                           \n');
    progress.update();
    await sleep(500)

    console.log('');
    let destination = await question('> Where to save? (skipping this will output the result to the console) \n >> ');
    console.log('');

    progress.reset();
    process.stdout.write('\r[ ] Writing to file...                                               ');    
    progress.update(0);
    await sleep(1000)

    try {
        if (destination !== '' & !!destination) {
            fs.writeFileSync(destination+'.json', JSON.stringify(fetched, null, '\t'));
            process.stdout.write('\r[x] DONE                                                            \n\n');
            progress.update(10);
            await sleep(1000)
            process.stdout.write('\n');
        } else {
            process.stdout.write('\r[x] DONE                                                            \n\n');
            progress.update(10);
            await sleep(1000)
            process.stdout.write('\n\n');
            console.log(fetched);
        }
    } catch (err) {
        console.log('ERROR: IMPOSSIBLE TO WRITE CONTENT. OUTPUTTING TO CONSOLE...');
        process.stdout.write('\r[x] DONE                                                            \n\n');
        progress.update(10);
        await sleep(1000)
        process.stdout.write('\n\n');
        console.log(fetched);
    }
    rl.close();
}
main();

// perguntas:
// general nickname
// password complexity according to age?
   //// if so, password complexity decreases with age increasing
// add general information:
// cv?
 
// senha => acao=gerar_senha&txt_tamanho=12&txt_quantidade=1&ckb_maiusculas=true&ckb_minusculas=true&ckb_numeros=true&ckb_especiais=true
// cartao => acao=gerar_cc&pontuacao=S&bandeira=${bandeira}
// titulo de eleitor => acao=gerar_titulo_eleitor&estado=${basicInfo.estado}

//car api 2 : https://lyjacky11.github.io/CarsGenerator/
//https://www.4devs.com.br/gerador_de_titulo_de_eleitor