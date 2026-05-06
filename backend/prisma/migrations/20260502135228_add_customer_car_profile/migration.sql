-- CreateEnum
CREATE TYPE "CarType" AS ENUM ('sedan', 'hatchback', 'suv', 'pickup', 'van', 'coupe', 'other');

-- AlterTable
ALTER TABLE "services" ADD COLUMN     "car_types" "CarType"[] DEFAULT ARRAY[]::"CarType"[];

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "car_color" TEXT,
ADD COLUMN     "car_make" TEXT,
ADD COLUMN     "car_plate" TEXT,
ADD COLUMN     "car_type" "CarType";
