/**
 * File: server.js (Railway / Node.js用)
 * Phantom Node Kernel - High-Performance Proxy Engine
 * 1. Expressベースのプロキシサーバー
 * 2. HTML/JS/CSS の動的リライト機能を搭載
 * 3. YouTube/Google 等の複雑なサイトへの対応を強化
 */

const express = require('express');
const fetch = require('node-fetch');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Base64URL Safe エンコード/デコード
const encodeUrl = (url) => Buffer.from(url).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const decodeUrl = (str) => Buffer.from(str.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf-8');

app.use(express.json());

// 静的ファイルの提供 (webp.jsをブラウザから読み込めるようにする)
app.get('/webp.js', (req, res) => {
    res.sendFile(path.join(__dirname, 'webp.js'));
});

// プロキシエンドポイント
app.all('/proxy', async (req, res) => {
    const encoded = req.query.e;
    if (!encoded) return res.status(400).send('Target Required');

    let targetUrl;
    try {
        targetUrl = decodeUrl(encoded);
    } catch (e) {
        return res.status(400).send('Invalid URL Encoding');
    }

    const urlObj = new URL(targetUrl);
    const PROXY_BASE = `${req.protocol}://${req.get('host')}/proxy?e=`;
    const JS_ENGINE_URL = `${req.protocol}://${req.get('host')}/webp.js`;

    // ヘッダーの構築 (セキュリティヘッダーをターゲットに合わせる)
    const headers = {};
    for (let [key, value] of Object.entries(req.headers)) {
        if (!['host', 'connection', 'referer', 'origin', 'cf-ray', 'cf-connecting-ip'].includes(key)) {
            headers[key] = value;
        }
    }
    headers['origin'] = urlObj.origin;
    headers['referer'] = urlObj.href;

    try {
        const response = await fetch(targetUrl, {
            method: req.method,
            headers: headers,
            body: (req.method !== 'GET' && req.method !== 'HEAD') ? JSON.stringify(req.body) : undefined,
            redirect: 'manual'
        });

        // リダイレクト処理 (301, 302 等)
        if (response.status >= 300 && response.status < 400) {
            const location = response.headers.get('location');
            if (location) {
                const absLocation = new URL(location, targetUrl).href;
                return res.redirect(response.status, `${PROXY_BASE}${encodeUrl(absLocation)}`);
            }
        }

        const contentType = response.headers.get('content-type') || '';
        let body = await response.buffer();

        // コンテンツのリライト
        if (contentType.includes('text/html')) {
            let html = body.toString();
            // JSエンジン注入とBaseタグ設定
            html = html.replace(/<head(.*?)>/i, `<head$1><script src="${JS_ENGINE_URL}"></script><base href="${targetUrl}">`);
            
            // HTML内の属性リライト
            html = html.replace(/(src|href|srcset|action)=["'](.*?)["']/gi, (match, attr, url) => {
                if (url.startsWith('http') || url.startsWith('/') || url.startsWith('./')) {
                    try {
                        const abs = new URL(url, targetUrl).href;
                        return `${attr}="${PROXY_BASE}${encodeUrl(abs)}"`;
                    } catch (e) { return match; }
                }
                return match;
            });
            body = Buffer.from(html);
        } else if (contentType.includes('javascript') || contentType.includes('json')) {
            let js = body.toString();
            // JS内のURLらしき文字列を置換 (YouTubeの動的チャンク対策)
            js = js.replace(/https?:\/\/[\w\.\-\/]+/gi, (match) => {
                if (match.includes('google') || match.includes('youtube') || match.includes('ytimg')) {
                    return `${PROXY_BASE}${encodeUrl(match)}`;
                }
                return match;
            });
            body = Buffer.from(js);
        } else if (contentType.includes('css')) {
            let css = body.toString();
            css = css.replace(/url\((.*?)\)/gi, (match, url) => {
                const cleanUrl = url.trim().replace(/["']/g, '');
                try {
                    const abs = new URL(cleanUrl, targetUrl).href;
                    return `url("${PROXY_BASE}${encodeUrl(abs)}")`;
                } catch (e) { return match; }
            });
            body = Buffer.from(css);
        }

        // レスポンスヘッダーのクリーンアップ
        res.set('Content-Type', contentType);
        res.set('Access-Control-Allow-Origin', '*');
        res.removeHeader('Content-Security-Policy');
        res.removeHeader('X-Frame-Options');
        
        res.status(response.status).send(body);

    } catch (err) {
        res.status(500).send('Proxy Error: ' + err.message);
    }
});

app.listen(PORT, () => console.log(`Phantom Node Server running on port ${PORT}`));
