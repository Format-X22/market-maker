import { ApiProperty } from '@nestjs/swagger';
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';
import mongoose from 'mongoose';

@Schema({ versionKey: false })
export class Candle {
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

export type CandleDocument = Candle & Document;
export const CandleSchema: mongoose.Schema<CandleDocument> = SchemaFactory.createForClass<
    Candle,
    CandleDocument
>(Candle);
