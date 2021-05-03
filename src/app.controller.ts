import { Controller, Post } from '@nestjs/common';
import { AppService } from './app.service';

@Controller()
export class AppController {
    constructor(private readonly appService: AppService) {}

    @Post('/sync')
    async sync(): Promise<string> {
        this.appService.sync();
        return 'Sync started';
    }

    @Post('/simulate')
    async simulate(): Promise<string> {
        this.appService.simulate();
        return 'Simulator started';
    }
}
