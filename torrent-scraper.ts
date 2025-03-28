/// <reference path="../anime-torrent-provider.d.ts" />

declare const registerProvider: (provider: any) => void;

class Provider {
    private sources = [
        { url: "https://nyaa.si/?page=rss&c=1_2&q=", isNyaa: true },
        { url: "https://apibay.org/q.php?q=", isNyaa: false }
    ];

    async search(opts: AnimeSearchOptions): Promise<AnimeTorrent[]> {
        const torrents: AnimeTorrent[] = [];
        const query = opts.media?.englishTitle || opts.query; // Ensure Nyaa uses englishTitle

        for (const source of this.sources) {
            try {
                const results = await this.fetchTorrents(source.url, query, source.isNyaa);
                torrents.push(...results);
            } catch (error) {
                console.error(`Failed to fetch from ${source.url}:`, error);
            }
        }

        return torrents;
    }

    async fetchTorrents(sourceUrl: string, query: string, isNyaa: boolean): Promise<AnimeTorrent[]> {
        const searchQuery = isNyaa ? `${query} -batch` : query; // Add "-batch" to refine Nyaa results
        const url = `${sourceUrl}${encodeURIComponent(searchQuery)}`;

        const response = await fetch(url);
        if (!response.ok) throw new Error(`Error fetching torrents: ${response.statusText}`);

        if (sourceUrl.includes("apibay.org")) {
            const json = await response.json();
            return this.parsePirateBayJson(json, query);
        }

        const xmlText = await response.text();
        return this.parseXML(xmlText, query);
    }

    private parseXML(xmlText: string, query: string): AnimeTorrent[] {
        const torrents: AnimeTorrent[] = [];
        const itemRegex = /<item>([\s\S]*?)<\/item>/g;
        let match;

        while ((match = itemRegex.exec(xmlText)) !== null) {
            const itemXml = match[1];
            const title = this.getTagContent(itemXml, "title");

            if (!this.isTitleRelevant(title, query)) continue; // Better filtering

            const link = this.getTagContent(itemXml, "link");
            const infoHash = this.getNyaaTagContent(itemXml, "infoHash");
            const size = this.getNyaaTagContent(itemXml, "size");
            const seeders = parseInt(this.getNyaaTagContent(itemXml, "seeders")) || 0;
            const leechers = parseInt(this.getNyaaTagContent(itemXml, "leechers")) || 0;

            torrents.push({
                name: title,
                downloadUrl: link,
                magnetLink: `magnet:?xt=urn:btih:${infoHash}`,
                infoHash,
                size: this.convertSizeToBytes(size),
                formattedSize: size,
                seeders,
                leechers,
                downloadCount: 0,
                resolution: "",
                isBatch: title.toLowerCase().includes("batch"),
                isBestRelease: false,
                confirmed: false
            });
        }

        return torrents;
    }

    private isTitleRelevant(title: string, query: string): boolean {
        return title.toLowerCase().replace(/[^a-z0-9]/g, "").includes(
            query.toLowerCase().replace(/[^a-z0-9]/g, "")
        );
    }

    private parsePirateBayJson(json: any[], query: string): AnimeTorrent[] {
        return json
            .filter(torrent => torrent.name.toLowerCase().includes(query.toLowerCase())) // Apibay unchanged
            .map(torrent => ({
                name: torrent.name,
                downloadUrl: `https://pirateproxy.live/torrent/${torrent.id}`,
                magnetLink: `magnet:?xt=urn:btih:${torrent.info_hash}`,
                infoHash: torrent.info_hash,
                size: parseInt(torrent.size),
                formattedSize: `${(parseInt(torrent.size) / (1024 * 1024)).toFixed(2)} MB`,
                seeders: parseInt(torrent.seeders),
                leechers: parseInt(torrent.leechers),
                downloadCount: 0,
                resolution: "",
                isBatch: false,
                isBestRelease: false,
                confirmed: false
            }));
    }

    private getTagContent(xml: string, tag: string): string {
        const regex = new RegExp(`<${tag}[^>]*>([^<]*)</${tag}>`);
        const match = xml.match(regex);
        return match ? match[1].trim() : "";
    }

    private getNyaaTagContent(xml: string, tag: string): string {
        const regex = new RegExp(`<nyaa:${tag}[^>]*>([^<]*)</nyaa:${tag}>`);
        const match = xml.match(regex);
        return match ? match[1].trim() : "";
    }

    private convertSizeToBytes(size: string): number {
        const match = size.match(/^([\d.]+)\s*([KMGT]iB)$/);
        if (!match) return 0;
        const [, num, unit] = match;
        const multipliers: { [key: string]: number } = {
            "KiB": 1024,
            "MiB": 1024 * 1024,
            "GiB": 1024 * 1024 * 1024,
            "TiB": 1024 * 1024 * 1024 * 1024
        };
        return Math.round(parseFloat(num) * multipliers[unit]);
    }
}
