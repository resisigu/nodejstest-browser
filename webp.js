/**
 * File: webp.js (フロントエンド制御用)
 * Phantom Trinity Engine v22
 * 1. iframe内でのURL操作をフック
 * 2. 親フレーム(Workers UI)とのURL同期
 * 3. リンクのクリックをプロキシ経由に強制
 */

(function() {
    // 自身がiframe内かどうかを判定
    const isInsideIframe = (window.self !== window.top);
    if (!isInsideIframe) return;

    const PROXY_BASE = window.location.origin + window.location.pathname + "?e=";

    // URLのデコード
    const unwrap = (url) => {
        try {
            const match = url.match(/[?&]e=([^&]+)/);
            if (!match) return url;
            let b64 = match[1].replace(/-/g, '+').replace(/_/g, '/');
            while (b64.length % 4) b64 += '=';
            return decodeURIComponent(escape(atob(b64)));
        } catch(e) { return url; }
    };

    const currentRealUrl = unwrap(window.location.href);

    // 1. 親フレームへのURL通知
    const notifyParent = () => {
        window.parent.postMessage({
            type: 'urlUpdate',
            url: unwrap(window.location.href),
            title: document.title
        }, '*');
    };

    // 初回と変更時に実行
    notifyParent();
    window.addEventListener('load', notifyParent);
    
    // 定期的に通知（SPAなどのハッシュ変更対策）
    setInterval(notifyParent, 2000);

    // 2. ブラウザAPIの偽装
    try {
        // window.location の一部をプロキシURLではなく元のURLとして見せる
        const originalLocation = window.location;
        const locationProxy = new Proxy(originalLocation, {
            get: (target, prop) => {
                if (prop === 'href') return unwrap(target.href);
                if (prop === 'origin') return new URL(unwrap(target.href)).origin;
                const val = target[prop];
                return typeof val === 'function' ? val.bind(target) : val;
            }
        });
        window.v_location = locationProxy;
    } catch(e) {}

    // 3. リンククリックの横取り (念のため)
    document.addEventListener('click', (e) => {
        const a = e.target.closest('a');
        if (a && a.href && !a.href.startsWith(window.location.origin)) {
            // プロキシURLに変換されていない外部リンクがあれば処理（基本はサーバー側で置換済み）
        }
    }, true);

})();
