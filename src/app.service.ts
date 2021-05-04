import { Injectable, Logger } from '@nestjs/common';
import * as ccxt from 'ccxt';
import { Exchange, OHLCV } from 'ccxt';
import * as moment from 'moment';
import * as sleep from 'sleep-promise';
import { Model } from 'mongoose';
import { Candle, CandleDocument } from './candle.schema';
import { InjectModel } from '@nestjs/mongoose';

type TOrder = {
    price: number;
    amount: number;
    isStop: boolean;
    cancelFor?: TOrder;
    prev?: TOrder;
    next?: TOrder;
};
type TOrderPack = {
    upIn: TOrder;
    upStop: TOrder;
    downIn: TOrder;
    downStop: TOrder;
};
type TOrderConfig = {
    upEnterPadding: number;
    downEnterPadding: number;
    upStopPadding: number;
    downStopPadding: number;
    stopMove: number;
    initialMargin: number;
    maintenanceMargin: number;
};
type TGlass = Array<TOrder>;

const CANDLES_LIMIT: number = 1000;
const SYNC_START: number = Number(moment('01.04.2021', 'DD.MM.YYYY'));
const CANDLE_SIZE_MINUTES: number = 5;
const HOUR: number = 60;
const HALF: number = 30;
const FOURTH: number = 15;
const START_AMOUNT: number = 100;

enum ETimeframe {
    m15 = 'm15',
    m30 = 'm30',
    h1 = 'h1',
    h2 = 'h2',
    h4 = 'h4',
}

const PACK_BY_TIME: Record<ETimeframe, number> = {
    [ETimeframe.m15]: FOURTH / CANDLE_SIZE_MINUTES,
    [ETimeframe.m30]: HALF / CANDLE_SIZE_MINUTES,
    [ETimeframe.h1]: HOUR / CANDLE_SIZE_MINUTES,
    [ETimeframe.h2]: (HOUR * 2) / CANDLE_SIZE_MINUTES,
    [ETimeframe.h4]: (HOUR * 4) / CANDLE_SIZE_MINUTES,
};

@Injectable()
export class AppService {
    private readonly logger: Logger = new Logger(AppService.name);
    private readonly exchange: Exchange = new ccxt.bitmex();

    constructor(@InjectModel(Candle.name) private CandleModel: Model<CandleDocument>) {}

    async sync(): Promise<void> {
        let since: number = SYNC_START;

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

    async simulate(): Promise<void> {
        const candles: AsyncGenerator<Candle> = this.makeCandlesQueueBy(ETimeframe.h1);
        const upGlass: TGlass = [];
        const downGlass: TGlass = [];
        const flowVolume: number = START_AMOUNT;

        const orderConfig: TOrderConfig = {
            upEnterPadding: 0.1,
            downEnterPadding: 0.1,
            upStopPadding: 9.5,
            downStopPadding: 9.5,
            stopMove: 0.5,
            initialMargin: 1,
            maintenanceMargin: 0.5,
        };

        for await (const candle of candles) {
            const orderPack: TOrderPack = this.makeOrders(candle, orderConfig, flowVolume);

            this.pushToGlass(upGlass, downGlass, orderPack);

            // TODO -
        }
    }

    private async saveCandles(rawCandles: Array<OHLCV>): Promise<void> {
        for (const rawCandle of rawCandles) {
            await this.CandleModel.updateOne(
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

    private async *makeCandlesQueueBy(timeframe: ETimeframe): AsyncGenerator<Candle> {
        const pack: number = PACK_BY_TIME[timeframe];
        const computedCandle: Candle = {
            timestamp: 0,
            open: 0,
            high: 0,
            low: Infinity,
            close: 0,
        };
        let bufferedCount: number = 0;

        for await (const candle of this.makeCandlesQueue()) {
            bufferedCount++;

            if (candle.high > computedCandle.high) {
                computedCandle.high = candle.high;
            }

            if (candle.low < computedCandle.low) {
                computedCandle.low = candle.low;
            }

            if (bufferedCount === 1) {
                computedCandle.timestamp = candle.timestamp;
                computedCandle.open = candle.open;
            }

            if (bufferedCount === pack) {
                computedCandle.close = candle.close;

                yield { ...computedCandle };

                computedCandle.timestamp = 0;
                computedCandle.open = 0;
                computedCandle.high = 0;
                computedCandle.low = Infinity;
                computedCandle.close = 0;

                bufferedCount = 0;
            }
        }
    }

    private async *makeCandlesQueue(): AsyncGenerator<Candle> {
        const currentData: Array<Candle> = [];
        let currentTimestamp: number = 0;

        while (true) {
            if (currentTimestamp === 0) {
                currentData.push(...(await this.getCandles(currentTimestamp)));

                if (!currentData.length) {
                    throw new Error('Empty history?');
                }
            }

            if (!currentData.length) {
                currentData.push(...(await this.getCandles(currentTimestamp)));

                if (!currentData.length) {
                    break;
                }
            }

            currentTimestamp = currentData[currentData.length - 1].timestamp;

            while (true) {
                if (!currentData.length) {
                    break;
                }

                yield currentData.shift();
            }
        }
    }

    private async getCandles(after: number): Promise<Array<Candle>> {
        const candles: Array<Candle> | null = await this.CandleModel.find(
            { timestamp: { $gt: after } },
            { _id: false },
            { limit: CANDLES_LIMIT, sort: { timestamp: 1 } },
        );

        return candles || [];
    }

    private makeOrders(candle: Candle, orderConfig: TOrderConfig, flowVolume: number): TOrderPack {
        const upIn: TOrder = {
            price: this.round(candle.open * (1 + orderConfig.upEnterPadding / 100)),
            amount: flowVolume,
            isStop: false,
        };
        const upStop: TOrder = {
            price: this.round(candle.open * (1 + orderConfig.upStopPadding / 100)),
            amount: flowVolume,
            isStop: true,
        };
        const downIn: TOrder = {
            price: this.round(candle.open * (1 - orderConfig.downEnterPadding / 100)),
            amount: flowVolume,
            isStop: false,
        };
        const downStop: TOrder = {
            price: this.round(candle.open * (1 - orderConfig.downStopPadding / 100)),
            amount: flowVolume,
            isStop: true,
        };

        upIn.cancelFor = downStop;
        downIn.cancelFor = upStop;
        upStop.cancelFor = downIn;
        downStop.cancelFor = upIn;

        return { upIn, upStop, downIn, downStop };
    }

    private pushToGlass(upGlass: TGlass, downGlass: TGlass, orderPack: TOrderPack): void {
        // TODO -
    }

    private round(price: number): number {
        // TODO -
        return 0;
    }
}
