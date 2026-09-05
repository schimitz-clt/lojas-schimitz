import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { FavoritesController } from './favorites.controller';
import { FavoritesService } from './favorites.service';

@Module({
  imports: [JwtModule.register({})],
  controllers: [FavoritesController],
  providers: [FavoritesService],
})
export class FavoritesModule {}
