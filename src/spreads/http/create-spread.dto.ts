import { IsNotEmpty, IsString, IsUUID, MaxLength } from 'class-validator';

export class CreateSpreadDto {
  // TODO(auth): taken from the body until authority-service-api issues verified tokens.
  @IsUUID()
  userId: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(1_000)
  question: string;
}
