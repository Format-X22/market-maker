import { ApiProperty } from '@nestjs/swagger';
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';
import mongoose from 'mongoose';

@Schema({ versionKey: false })
export class Candles {
    @Prop({ unique: true })
    @ApiProperty()
    timestamp: number;

    @Prop()
    @ApiProperty()
    open: number;

    @Prop()
    @ApiProperty()
    high: number;

    @Prop()
    @ApiProperty()
    low: number;

    @Prop()
    @ApiProperty()
    close: number;
}

export type CandlesDocument = Candles & Document;
export const CandlesSchema: mongoose.Schema<CandlesDocument> = SchemaFactory.createForClass<
    Candles,
    CandlesDocument
>(Candles);
