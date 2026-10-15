#include<bits/stdc++.h>
using namespace std;

class Node{
    public:
    string name;
    Node* next;

    Node(string n){
        name=n;
        next=NULL;
    }
};

class Queue{
    public:
    Node* front;
    Node* rear;

    Queue(){
        front=NULL;
        rear=NULL;
    }

    bool isempty(){
        if(front==NULL){
            return true;
        }
        return false;
    }

    void insert(string name){
        Node* newnode=new Node(name);

        if(isempty()){
            front=newnode;
            rear=newnode;
        }
        else{
            rear->next=newnode;
            rear=newnode;
        }
        cout<<name<<" added to the queue"<<endl;
    }

    void remove(){
        if(isempty()){
            cout<<"Queue is empty, no passenger to remove"<<endl;
            return;
        }

        Node* temp=front;
        cout<<temp->name<<" removed from the queue"<<endl;
        front=front->next;

        if(front==NULL){
            rear=NULL;
        }
        delete temp;
    }

    void showfront(){
        if(isempty()){
            cout<<"Queue is empty, no passenger at front"<<endl;
            return;
        }
        cout<<"Passenger at front: "<<front->name<<endl;
    }

    int count(){
        int c=0;
        Node* ptr=front;
        while(ptr!=NULL){
            c++;
            ptr=ptr->next;
        }
        return c;
    }
};

int main(){
    Queue ticketline;
    int choice;

    while(true){
        cout<<"\nMenu:"<<endl;
        cout<<"1. Insert a passenger at the rear"<<endl;
        cout<<"2. Display passenger at the front"<<endl;
        cout<<"3. Remove passenger from the front"<<endl;
        cout<<"4. Exit"<<endl;
        cout<<"Enter your choice: ";
        cin>>choice;

        if(choice==1){
            string name;
            cout<<"Enter passenger name: ";
            cin>>name;
            ticketline.insert(name);
        }
        else if(choice==2){
            ticketline.showfront();
        }
        else if(choice==3){
            ticketline.remove();
        }
        else if(choice==4){
            cout<<"Number of passengers left in the queue: "<<ticketline.count()<<endl;
            cout<<"Exiting program"<<endl;
            break;
        }
        else{
            cout<<"Invalid choice!"<<endl;
        }
    }

    return 0;
}