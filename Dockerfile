# 1. ベースイメージの指定 (Node.js 20)
FROM node:20-slim

# 2. 必要なライブラリのインストール (プロキシ動作に必要な最小構成)
RUN apt-get update && apt-get install -y \
    curl \
    && rm -rf /var/lib/apt/lists/*

# 3. 作業ディレクトリの作成
WORKDIR /app

# 4. 依存関係のコピーとインストール
COPY package.json ./
RUN npm install --production

# 5. ソースコードのコピー
COPY server.js ./
COPY webp.js ./

# 6. ポートの開放
EXPOSE 3000

# 7. アプリの起動
CMD ["node", "server.js"]
