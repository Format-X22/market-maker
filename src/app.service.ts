import { Injectable, Logger } from '@nestjs/common';
import * as ccxt from 'ccxt';
import { Exchange, OHLCV } from 'ccxt';
import * as moment from 'moment';
import * as sleep from 'sleep-promise';
import { Model } from 'mongoose';
import { Candles, CandlesDocument } from './candles.schema';
import { InjectModel } from '@nestjs/mongoose';

const CANDLES_LIMIT: number = 1000;
const START: number = Number(moment('01.04.2021', 'DD.MM.YYYY'));

@Injectable()
export class AppService {
    private readonly logger: Logger = new Logger(AppService.name);
    private readonly exchange: Exchange = new ccxt.bitmex();

    constructor(@InjectModel(Candles.name) private CandlesModel: Model<CandlesDocument>) {}

    async sync(): Promise<void> {
        let since: number = START;

        while (true) {
            this.logger.log(`Load since ${moment(since)}`);

            const rawCandles: Array<OHLCV> = await this.exchange.fetchOHLCV(
                'BTC/USD',
                '5m',
                since,
                CANDLES_LIMIT,
            );

            if (!rawCandles.length) {
                break;
            }

            const lastCandleTimestamp: number = rawCandles[rawCandles.length - 1][0];

            since = Number(moment(lastCandleTimestamp).add(1, 'second'));

            await this.saveCandles(rawCandles);
            await sleep(this.exchange.rateLimit);
        }

        this.logger.log('Loaded');
    }

    private async saveCandles(rawCandles: Array<OHLCV>): Promise<void> {
        for (const rawCandle of rawCandles) {
            await this.CandlesModel.updateOne(
                { timestamp: rawCandle[0] },
                {
                    timestamp: rawCandle[0],
                    open: rawCandle[1],
                    high: rawCandle[2],
                    low: rawCandle[3],
                    close: rawCandle[4],
                },
                { upsert: true },
            );
        }
    }
}
