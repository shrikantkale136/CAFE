import { Component, EventEmitter, Inject, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { error } from 'console';
import { CategoryService } from 'src/app/services/category.service';
import { ProductService } from 'src/app/services/product.service';
import { SnackbarService } from 'src/app/services/snackbar.service';
import { GlobalConstants } from 'src/app/shared/global-constants';

@Component({
  selector: 'app-product',
  templateUrl: './product.component.html',
  styleUrls: ['./product.component.scss'],
})
export class ProductComponent implements OnInit {
  onAddCategory = new EventEmitter();
  onEditCategory = new EventEmitter();
  productForm: any = FormGroup;
  dialogAction: any = 'Add';
  action: any = 'Add';
  responseMessage: any;
  categories: any = [];
  backOrderQTY!: number ;

  constructor(
    @Inject(MAT_DIALOG_DATA) public dialogData: any,
    private fb: FormBuilder,
    private productService: ProductService,
    private categoryService: CategoryService,
    public dialogRef: MatDialogRef<ProductComponent>,
    private snackBar: SnackbarService
  ) {}

  ngOnInit(): void {
    this.productForm = this.fb.group({
      name: [
        null,
        [Validators.required, Validators.pattern(GlobalConstants.nameRegex)],
      ],
      categoryId: [null, [Validators.required]],
      price: [null, [Validators.required]],
      quantity: [null, [Validators.required]],
      description: [null, [Validators.required]],
    });

    if (this.dialogData.action === 'Edit') {
      this.dialogAction = 'Edit';
      this.action = 'Update';
      console.log(this.dialogData.data)
      this.productForm.patchValue(this.dialogData.data);
    }

    this.getCategories();
  }

  getCategories() {
    this.categoryService.getCategories().subscribe(
      (resp: any) => {
        this.categories = resp.data;
      },
      (error) => {
        if (error.error?.message) {
          this.responseMessage = error.error?.message;
        } else {
          this.responseMessage = GlobalConstants.genericError;
        }
        this.snackBar.openSnackBar(this.responseMessage, GlobalConstants.error);
      }
    );
  }

  handleSubmit() {
    if (this.dialogAction === 'Edit') {
      this.edit();
    } else if (this.dialogAction === 'Add') {
      this.add();
    }
  }

  add() {
    let formData = this.productForm.value;
    let data = {
      name: formData.name,
      categoryID: formData.categoryId,
      price: formData.price,
      quantity: formData.quantity,
      description: formData.description,
    };

    this.productService.add(data).subscribe(
      (resp: any) => {
        this.dialogRef.close();
        this.onAddCategory.emit();
        this.responseMessage = resp.message;
        this.snackBar.openSnackBar(this.responseMessage, 'success');
      },
      (error) => {
        this.dialogRef.close();
        if (error.error?.message) {
          this.responseMessage = error.error?.message;
        } else {
          this.responseMessage = GlobalConstants.genericError;
        }
        this.snackBar.openSnackBar(this.responseMessage, GlobalConstants.error);
      }
    );
  }

  checkbackOrderQty(id:any) {
    
  }

  edit() {
    let formData = this.productForm.value;
    let updatedQty!:number;
    this.productService.checkBackOrderQty(this.dialogData.data.id).subscribe((res:any)=>{
      // console.log("checkbackOrderQty: ", res.data[0].quantity);
      
       this.backOrderQTY = (res.data.length > 0) ? res.data[0].quantity : null;
       updatedQty =  this.backOrderQTY && this.backOrderQTY != 0 ? formData.quantity -  this.backOrderQTY : formData.quantity;

       let data = {
        id: this.dialogData.data.id,
        name: formData.name,  
        categoryID: formData.categoryId,
        price: formData.price,
        quantity: updatedQty,
        description: formData.description,
      };
     
      this.productService.update(data).subscribe(
        (resp: any) => {
          this.dialogRef.close();
          this.onEditCategory.emit();
          this.responseMessage = resp.message;
          this.snackBar.openSnackBar(this.responseMessage, 'success');
        },
        (error) => {
          this.dialogRef.close();
          if (error.error?.message) {
            this.responseMessage = error.error?.message;
          } else {
            this.responseMessage = GlobalConstants.genericError;
          }
          this.snackBar.openSnackBar(this.responseMessage, GlobalConstants.error);
        }
      );

      // if(this.backOrderQTY >= 0) {
      //   this.productService.updateBackOrderQty({id: this.dialogData.data.id, quantity: this.backOrderQTY})
      //   .subscribe((res:any)=>{
      //     console.log("updateBackOrderQty: ", res);
      //   },error=>{
      //     console.log(error);
      //   }
      //   )     
      // }

    }, error => {
      console.log(error)
    }
    )


    
  }

  delete() {}
}
